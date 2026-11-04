/* Meowdoku: motor de quebra-cabeças. Sem dependências. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MeowCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MIN_SIZE = 4;
  const MAX_SIZE = 30;
  const DIFFICULTIES = ['facil', 'medio', 'dificil', 'extremo'];
  const DIFFICULTY_NAMES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', extremo: 'Extremo' };
  const VERSION = 1;

  function hashString(text) {
    let h = 2166136261 >>> 0;
    for (const char of String(text)) {
      h ^= char.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRandom(seed) {
    let state = hashString(seed);
    return function () {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(array, random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const aux = array[i]; array[i] = array[j]; array[j] = aux;
    }
    return array;
  }
  function randomSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const values = new Uint32Array(2);
      crypto.getRandomValues(values);
      return Array.from(values, n => n.toString(36)).join('-');
    }
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
  function neighbors(index, n) {
    const row = Math.floor(index / n), col = index % n;
    const result = [];
    if (row > 0) result.push(index - n);
    if (row < n - 1) result.push(index + n);
    if (col > 0) result.push(index - 1);
    if (col < n - 1) result.push(index + 1);
    return result;
  }
  function randomSolution(n, random) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let attempt = 0; attempt < 350; attempt++) {
      shuffle(arr, random);
      if (arr.every((col, row) => row === 0 || Math.abs(col - arr[row - 1]) > 1)) return arr.slice();
    }
    // Permutação válida para todo N >= 4: colunas pares seguidas das ímpares,
    // em indexação 1-based (inclui as exceções via rotação alternada).
    function backtrack(row, columns, out) {
      if (row === n) return true;
      const options = shuffle(Array.from({ length: n }, (_, i) => i), random);
      for (const col of options) {
        if ((columns & (1 << col)) || (row && Math.abs(out[row - 1] - col) <= 1)) continue;
        out[row] = col;
        if (backtrack(row + 1, columns | (1 << col), out)) return true;
      }
      return false;
    }
    const fallback = [];
    if (!backtrack(0, 0, fallback)) throw new Error('Não foi possível criar uma solução inicial.');
    return fallback;
  }
  /**
   * Conta soluções exatas de um tabuleiro, sem consultar a solução original.
   * Usa restrições de linha, coluna e região com menor domínio primeiro (MRV).
   * Atribuições parciais e casas proibidas são opcionais.
   */
  function solve(board, options = {}) {
    const n = board.size;
    const regions = board.regions;
    const solutionLimit = options.limit || 2;
    const nodeLimit = options.nodeLimit || 60000;
    const forced = options.forced || [];
    const forbidden = options.forbidden || null;
    const assigned = Array(n).fill(-1);
    let nodes = 0, solutions = 0, first = null, truncated = false;
    let usedCols = 0, usedRegions = 0, startDepth = 0;
    const colBits = Array.from({ length: n }, (_, i) => 1 << i);
    for (const index of forced) {
      const row = Math.floor(index / n), col = index % n, g = regions[index];
      if (row < 0 || row >= n || col < 0 || col >= n || assigned[row] !== -1 ||
          (usedCols & colBits[col]) || (usedRegions & colBits[g])) {
        return { count: 0, nodes: 0, truncated: false, solution: null };
      }
      assigned[row] = col;
      usedCols |= colBits[col]; usedRegions |= colBits[g]; startDepth++;
    }
    for (let row = 1; row < n; row++) {
      if (assigned[row] !== -1 && assigned[row - 1] !== -1 &&
        Math.abs(assigned[row] - assigned[row - 1]) <= 1) {
        return { count: 0, nodes: 0, truncated: false, solution: null };
      }
    }
    function search(depth, cols, regs) {
      nodes++;
      if (nodes > nodeLimit) { truncated = true; return true; }
      if (depth === n) {
        solutions++;
        if (!first) first = assigned.slice();
        return solutions >= solutionLimit;
      }
      const rowCandidates = Array.from({ length: n }, () => []);
      const columnCandidates = Array.from({ length: n }, () => []);
      const regionCandidates = Array.from({ length: n }, () => []);
      for (let row = 0; row < n; row++) {
        if (assigned[row] !== -1) continue;
        for (let col = 0; col < n; col++) {
          if (cols & colBits[col]) continue;
          if (row > 0 && assigned[row - 1] !== -1 && Math.abs(assigned[row - 1] - col) <= 1) continue;
          if (row < n - 1 && assigned[row + 1] !== -1 && Math.abs(assigned[row + 1] - col) <= 1) continue;
          const idx = row * n + col;
          if (forbidden && forbidden[idx]) continue;
          const region = regions[idx];
          if (regs & colBits[region]) continue;
          rowCandidates[row].push(idx);
          columnCandidates[col].push(idx);
          regionCandidates[region].push(idx);
        }
      }
      let choice = null;
      for (let row = 0; row < n; row++) {
        if (assigned[row] !== -1) continue;
        const candidate = rowCandidates[row];
        if (candidate.length === 0) return false;
        if (!choice || candidate.length < choice.length) choice = candidate;
      }
      for (let col = 0; col < n; col++) {
        if (cols & colBits[col]) continue;
        const candidate = columnCandidates[col];
        if (candidate.length === 0) return false;
        if (candidate.length < choice.length) choice = candidate;
      }
      for (let region = 0; region < n; region++) {
        if (regs & colBits[region]) continue;
        const candidate = regionCandidates[region];
        if (candidate.length === 0) return false;
        if (candidate.length < choice.length) choice = candidate;
      }
      for (const idx of choice) {
        const row = Math.floor(idx / n), col = idx % n, region = regions[idx];
        assigned[row] = col;
        if (search(depth + 1, cols | colBits[col], regs | colBits[region])) return true;
        assigned[row] = -1;
      }
      return false;
    }
    search(startDepth, usedCols, usedRegions);
    return { count: solutions, nodes, truncated, solution: first };
  }
  function isConnectedAfterRemoval(regions, n, removedIndex, target = 0) {
    let start = -1, total = 0;
    for (let i = 0; i < regions.length; i++) {
      if (i !== removedIndex && regions[i] === target) { total++; if (start < 0) start = i; }
    }
    if (total === 0) return false;
    const seen = new Uint8Array(n * n);
    const queue = [start]; seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head];
      for (const nb of neighbors(p, n)) {
        if (nb !== removedIndex && regions[nb] === target && !seen[nb]) {
          seen[nb] = 1; queue.push(nb);
        }
      }
    }
    return queue.length === total;
  }
  function validateBoard(board, expectedSolution) {
    if (!board || !Number.isInteger(board.size) || board.size < MIN_SIZE || board.size > MAX_SIZE) return false;
    const n = board.size, regions = board.regions;
    if (!regions || regions.length !== n * n || regions.some(g => !Number.isInteger(g) || g < 0 || g >= n)) return false;
    for (let region = 0; region < n; region++) {
      const start = regions.indexOf(region);
      if (start < 0) return false;
      const queue = [start], visited = new Uint8Array(n * n); visited[start] = 1;
      for (let head = 0; head < queue.length; head++) {
        for (const next of neighbors(queue[head], n)) {
          if (!visited[next] && regions[next] === region) { visited[next] = 1; queue.push(next); }
        }
      }
      if (regions.filter(g => g === region).length !== queue.length) return false;
    }
    if (expectedSolution) {
      if (expectedSolution.length !== n || new Set(expectedSolution).size !== n) return false;
      const gs = new Set();
      for (let row = 0; row < n; row++) {
        const col = expectedSolution[row];
        if (!Number.isInteger(col) || col < 0 || col >= n ||
          (row && Math.abs(col - expectedSolution[row - 1]) <= 1)) return false;
        gs.add(regions[row * n + col]);
      }
      if (gs.size !== n) return false;
    }
    return true;
  }
  function normalizedConfig(config) {
    const size = Number(config.size);
    if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) throw new Error(`O tamanho precisa ficar entre ${MIN_SIZE} e ${MAX_SIZE}.`);
    const difficulty = DIFFICULTIES.includes(config.difficulty) ? config.difficulty : 'medio';
    const seed = String(config.seed || randomSeed()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!seed) throw new Error('Seed inválida.');
    return { size, difficulty, seed };
  }
  /**
   * Começa com uma partição de solução única demonstrável: N−1 regiões
   * unitárias fixam N−1 gatos. Expande essas regiões apenas se a solução
   * continuar ÚNICA e as duas regiões envolvidas continuarem conexas.
   * Toda fase aceita possui N regiões e uma solução exata verificada.
   * Os limites são determinísticos para que links reproduzam a mesma fase.
   */
  async function generateBoard(rawConfig, onProgress) {
    const config = normalizedConfig(rawConfig);
    const { size: n, difficulty, seed } = config;
    const random = makeRandom(`meow-${VERSION}-${seed}-${n}-${difficulty}`);
    const solution = randomSolution(n, random);
    const regions = new Array(n * n).fill(0);
    const counts = new Array(n).fill(1);
    for (let row = 1; row < n; row++) regions[row * n + solution[row]] = row;
    counts[0] = n * n - (n - 1);
    const baseline = n * n - n;
    const difficultyIndex = DIFFICULTIES.indexOf(difficulty);
    const targets = [0.28, 0.43, 0.58, 0.73];
    const performanceScale = n <= 12 ? 1 : n <= 16 ? 0.78 : n <= 22 ? 0.55 : 0.32;
    const desired = Math.floor(baseline * targets[difficultyIndex] * performanceScale);
    const maxProposals = n <= 12 ? Math.min(1200, n * n * 3) : n <= 18 ? n * 24 : n * 10;
    const limitNodes = n <= 12 ? 12000 : n <= 18 ? 5000 : 1100;
    let accepted = 0, attempts = 0, stale = 0;
    let blocked = new Set();
    const report = (progress) => { if (typeof onProgress === 'function') onProgress(progress); };
    report(0);
    while (attempts < maxProposals && accepted < desired && stale < Math.max(60, n * (n <= 15 ? 10 : 4))) {
      const candidate = [];
      for (let idx = 0; idx < regions.length; idx++) {
        if (regions[idx] !== 0 || idx === solution[0]) continue;
        for (const nearby of neighbors(idx, n)) {
          const group = regions[nearby];
          if (group <= 0) continue;
          const key = idx * n + group;
          if (!blocked.has(key) && !candidate.some(it => it.key === key)) {
            candidate.push({ idx, group, key, weight: counts[group] + random() * 2.7 });
          }
        }
      }
      if (!candidate.length) break;
      candidate.sort((a, b) => a.weight - b.weight);
      const pick = candidate[Math.floor(random() * Math.min(candidate.length, Math.max(3, Math.ceil(n / 3))))];
      attempts++; stale++;
      if (!isConnectedAfterRemoval(regions, n, pick.idx)) { blocked.add(pick.key); continue; }
      regions[pick.idx] = pick.group;
      const result = solve({ size: n, regions }, { limit: 2, nodeLimit: limitNodes });
      if (!result.truncated && result.count === 1) {
        counts[0]--; counts[pick.group]++;
        accepted++; stale = 0; blocked = new Set();
      } else {
        regions[pick.idx] = 0; blocked.add(pick.key);
      }
      // Libera a thread principal para pintura / interações.
      if (attempts % 24 === 0) {
        report(Math.min(0.96, accepted / Math.max(1, desired)));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    const board = { ...config, version: VERSION, regions, solution,
      generatedAt: Date.now(), expansion: accepted,
      requestedExpansion: desired };
    if (!validateBoard(board, solution)) throw new Error('A geração falhou na validação estrutural.');
    const verification = solve(board, { limit: 2, nodeLimit: Math.max(4000, limitNodes) });
    if (verification.truncated || verification.count !== 1 ||
        verification.solution.some((col, row) => col !== solution[row])) {
      throw new Error('A validação da solução única falhou.');
    }
    board.complexity = measureComplexity(board);
    report(1);
    return board;
  }
  /** Métrica heurística explicável, não declara precisão científica. */
  function measureComplexity(board) {
    const n = board.size, regionSizes = Array(n).fill(0);
    for (const r of board.regions) regionSizes[r]++;
    const small = regionSizes.filter(c => c <= 2).length;
    const coverage = (n * n - regionSizes[0] - (n - 1)) / Math.max(1, n * n - n);
    return { small, coverage: Math.max(0, coverage), label: coverage < 0.26 ? 'Introdução' : coverage < 0.41 ? 'Leve' : coverage < 0.57 ? 'Moderada' : 'Avançada' };
  }
  function validatePlacement(board, marks) {
    const n = board.size, perRow = Array(n).fill(0), perCol = Array(n).fill(0), perReg = Array(n).fill(0);
    let cats = 0;
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] !== 2) continue;
      cats++;
      const row = Math.floor(i / n), col = i % n, region = board.regions[i];
      perRow[row]++; perCol[col]++; perReg[region]++;
    }
    if (cats !== n || perRow.some(k => k !== 1) || perCol.some(k => k !== 1) || perReg.some(k => k !== 1)) return false;
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] !== 2) continue;
      const r = Math.floor(i / n), c = i % n;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && marks[rr * n + cc] === 2) return false;
      }
    }
    return true;
  }
  function forcedXCells(board, index) {
    const n = board.size, row = Math.floor(index / n), col = index % n, region = board.regions[index];
    const affected = [];
    for (let i = 0; i < n * n; i++) {
      if (i === index) continue;
      const rr = Math.floor(i / n), cc = i % n;
      if (rr === row || cc === col || board.regions[i] === region ||
          (Math.abs(rr - row) <= 1 && Math.abs(cc - col) <= 1)) affected.push(i);
    }
    return affected;
  }
  function findHint(board, marks) {
    const n = board.size;
    const chosen = [];
    const forbidden = new Uint8Array(n * n);
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] === 1) forbidden[i] = 1;
      if (marks[i] === 2) chosen.push(i);
    }
    // Dicas apenas para posições que continuam corretas e que não são X.
    for (let row = 0; row < n; row++) {
      const col = board.solution[row], idx = row * n + col;
      if (marks[idx] === 2) continue;
      if (marks[idx] === 1) return { kind: 'clear', index: idx, message: 'Esse X está escondendo uma posição necessária. Tente rever essa marcação.' };
      const rowOpen = Array.from({ length: n }, (_, c) => row * n + c).filter(i => marks[i] !== 1 && marks[i] !== 2);
      if (rowOpen.length === 1) return { kind: 'cat', index: idx, message: `Na linha ${row + 1}, só resta uma casa disponível para o gato.` };
      const region = board.regions[idx];
      const regionOpen = board.regions.map((g, i) => g === region && marks[i] !== 1 && marks[i] !== 2 ? i : -1).filter(i => i !== -1);
      if (regionOpen.length === 1) return { kind: 'cat', index: idx, message: 'Nesta região colorida, só resta uma casa possível.' };
    }
    for (let row = 0; row < n; row++) {
      const idx = row * n + board.solution[row];
      if (marks[idx] === 0) {
        return { kind: 'cat', index: idx, message: 'Esta casa precisa receber um gato. Experimente verificar linhas, colunas e regiões.' };
      }
    }
    return null;
  }
  return { VERSION, MIN_SIZE, MAX_SIZE, DIFFICULTIES, DIFFICULTY_NAMES, hashString,
    makeRandom, shuffle, randomSeed, neighbors, solve, validateBoard, normalizedConfig,
    generateBoard, measureComplexity, validatePlacement, forcedXCells, findHint };
});
