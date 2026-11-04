(function () {
  'use strict';
  const core = window.MeowCore;
  const KEY = 'meowdoku:save:1', SETTINGS_KEY = 'meowdoku:settings:1';
  const HISTORY_LIMIT = 80, UNDO_LIMIT = 150;
  const el = id => document.getElementById(id);
  const dom = {
    board: el('board'), scroll: el('boardScroll'), frame: el('boardFrame'),
    loading: el('loadingLayer'), loadingProgress: el('loadingProgress'), progressDisplay: el('progressDisplay'),
    gameMessage: el('gameMessage'), cats: el('catsCount'), hearts: el('heartDisplay'), timer: el('timerDisplay'),
    sizeTag: el('sizeTag'), difficultyTag: el('difficultyTag'), seed: el('seedDisplay'),
    generate: el('generateBtn'), size: el('customSize'), sizeMirror: el('sizeMirror'), sizes: el('sizePresets'),
    difficulties: el('difficultyGroup'), autoX: el('autoX'), theme: el('themeToggle'), sound: el('soundToggle'),
    undo: el('undoBtn'), redo: el('redoBtn'), reset: el('resetBtn'), hint: el('hintBtn'),
    share: el('shareBtn'), pan: el('panToggle'), zoomIn: el('zoomIn'), zoomOut: el('zoomOut'), zoomValue: el('zoomValue'),
    played: el('playedStat'), wins: el('winsStat'), best: el('bestStat'), mistakes: el('mistakeStat'),
    galleryBadge: el('galleryBadge'), resultDialog: el('resultDialog'), galleryDialog: el('galleryDialog'),
    galleryList: el('galleryList'), gallerySearch: el('gallerySearch'), toast: el('toast')
  };
  const defaultSettings = { size: 8, difficulty: 'medio', autoX: false, sound: true, dark: false };
  const settings = { ...defaultSettings, ...readJSON(SETTINGS_KEY, {}) };
  const persisted = readJSON(KEY, {});
  const stats = { played: 0, wins: 0, losses: 0, mistakes: 0, bests: {}, ...(persisted.stats || {}) };
  let history = Array.isArray(persisted.history) ? persisted.history : [];
  let game = null, undoStack = [], redoStack = [], zoom = 1, panMode = false;
  let dragging = null, highlighted = -1, loading = false, toastTimeout = null, saveTimeout = null;
  let timerInterval = null, recentError = -1, recentErrorTimeout = null;
  let palette = [], cellElements = [];
  const audios = {
    mark: createAudio('assets/audio/mark.wav'), cat: createAudio('assets/audio/cat.wav'),
    wrong: createAudio('assets/audio/wrong.wav'), victory: createAudio('assets/audio/victory.wav'),
    hint: createAudio('assets/audio/hint.wav')
  };

  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) { showToast('Armazenamento cheio ou indisponível. A partida não será salva.'); }
  }
  function saveSettings() { writeJSON(SETTINGS_KEY, settings); }
  function persist() {
    if (!game) return;
    writeJSON(KEY, { game, stats, history });
  }
  function queueSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(persist, 220);
  }
  function createAudio(url) {
    const audio = new Audio(url); audio.preload = 'auto'; audio.volume = 0.45; return audio;
  }
  function playSound(name) {
    if (!settings.sound || !audios[name]) return;
    try { const audio = audios[name].cloneNode(); audio.volume = name === 'victory' ? .48 : .33; audio.play().catch(() => {}); }
    catch (_) { /* áudio opcional */ }
  }
  function showToast(text) {
    clearTimeout(toastTimeout); dom.toast.textContent = text;
    dom.toast.classList.add('shown');
    toastTimeout = setTimeout(() => dom.toast.classList.remove('shown'), 3100);
  }
  function message(text, type = '') {
    dom.gameMessage.textContent = text;
    dom.gameMessage.className = 'game-message' + (type ? ` ${type}` : '');
  }
  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const min = Math.floor(seconds / 60), sec = seconds % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  function updateSettingsUI() {
    dom.size.value = settings.size;
    dom.sizeMirror.textContent = settings.size;
    dom.sizes.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.size) === settings.size));
    dom.difficulties.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.difficulty === settings.difficulty));
    dom.autoX.checked = !!settings.autoX;
    dom.theme.textContent = settings.dark ? '☀' : '☾';
    document.body.classList.toggle('dark', settings.dark);
    dom.sound.style.opacity = settings.sound ? '1' : '.45';
    dom.sound.title = settings.sound ? 'Desligar sons' : 'Ligar sons';
  }
  function changeSize(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    settings.size = Math.round(n);
    dom.sizeMirror.textContent = settings.size;
    dom.sizes.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.size) === settings.size));
    saveSettings();
  }
  function settingsFromURL() {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('seed')) return null;
    try { return core.normalizedConfig({ seed: query.get('seed'), size: query.get('n'), difficulty: query.get('d') }); }
    catch (_) { showToast('Link da fase inválido. Abrindo sua partida local.'); return null; }
  }
  function changeURL(board) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('n', board.size);
      url.searchParams.set('d', board.difficulty);
      url.searchParams.set('seed', board.seed);
      window.history.replaceState(null, '', url.toString());
    } catch (_) { /* Alguns navegadores limitam URLs file:// */ }
  }
  function sameConfig(a, b) {
    return !!a && !!b && a.seed === b.seed && a.size === b.size && a.difficulty === b.difficulty;
  }
  function validSavedGame(saved) {
    if (!saved || !saved.board || !Array.isArray(saved.marks)) return false;
    const b = saved.board;
    return b.version === core.VERSION && saved.marks.length === b.size * b.size &&
      Array.isArray(b.solution) && core.validateBoard(b, b.solution) &&
      saved.marks.every(m => m === 0 || m === 1 || m === 2);
  }
  function initGameFromBoard(board, restored = null) {
    game = restored || {
      board, marks: Array(board.size * board.size).fill(0), elapsed: 0,
      mistakes: 0, hints: 0, completed: false, lost: false, startedAt: Date.now()
    };
    undoStack = []; redoStack = []; zoom = 1; panMode = false; highlighted = -1;
    resetTap(); dragging = null;
    settings.size = board.size; settings.difficulty = board.difficulty;
    updateSettingsUI(); saveSettings(); changeURL(board);
    dom.pan.classList.remove('active'); dom.pan.setAttribute('aria-pressed', 'false');
    buildBoard(); updateBoard(); updateStats(); updateGameUI();
    message(game.completed ? 'Fase concluída! Esses gatinhos foram muito bem encontrados. 🐈' :
      game.lost ? 'Acabaram as vidas. Reinicie para tentar novamente! 💗' :
        'Marque os lugares impossíveis com X e encontre os gatinhos!');
    if (game.completed) message('Todos os gatos encontraram um cantinho. Miauravilhoso! 🏆', 'success');
    if (game.lost) message('Acabaram as vidas. Reinicie para tentar novamente! 💗', 'warning');
    queueSave();
  }
  function setLoading(value, progress = 0) {
    loading = value;
    dom.loading.hidden = !value;
    dom.generate.disabled = value;
    dom.progressDisplay.textContent = `${Math.round(progress * 100)}%`;
    dom.loadingProgress.style.width = `${Math.round(progress * 100)}%`;
  }
  async function newGame(config, isHistory = false) {
    if (loading) return;
    let normalized;
    try { normalized = core.normalizedConfig(config); }
    catch (err) { showToast(err.message); return; }
    setLoading(true, 0);
    await new Promise(resolve => setTimeout(resolve, 45));
    try {
      const existing = isHistory ? history.find(h => sameConfig(h.board, normalized)) : null;
      // Ao reabrir da galeria, carregamos a configuração exata originalmente salva.
      const board = existing && core.validateBoard(existing.board, existing.board.solution) ?
        existing.board : await core.generateBoard(normalized, progress => setLoading(true, progress));
      initGameFromBoard(board);
      if (!isHistory) stats.played++;
      rememberBoard(board);
      updateStats(); persist();
    } catch (err) {
      console.error('[Meowdoku] Erro na geração:', err);
      showToast('Não foi possível gerar a fase. Tente outra seed ou tamanho.');
      message('O gerador não conseguiu validar essa fase. Gere outra.', 'warning');
    } finally { setLoading(false, 1); }
  }
  function rememberBoard(board) {
    const prev = history.find(h => sameConfig(h.board, board));
    const entry = prev || { board: { ...board }, createdAt: Date.now(), finished: false, record: null };
    history = [entry, ...history.filter(h => !sameConfig(h.board, board))].slice(0, HISTORY_LIMIT);
    dom.galleryBadge.textContent = history.length;
    queueSave();
  }
  function paletteFor(board) {
    // Para até 8 regiões, nenhuma família de cor se repete. Antes, dois azuis
    // quase idênticos podiam aparecer em territórios diferentes (mesmo sem contato).
    const essential = [
      '#5078E0', // azul
      '#DA7535', // laranja
      '#2B9B50', // verde
      '#8F3DB8', // roxo
      '#B5B744', // amarelo-oliva
      '#CE6AA5', // rosa
      '#288C9F', // turquesa
      '#B82B3E'  // vermelho
    ];
    // Paleta complementar para mapas maiores: variações adicionais com
    // luminosidade e saturação próprias, sempre com um código por região.
    const extra = [
      '#879B39', '#6376AC', '#B77D3F', '#4B9A76', '#BD6C9D',
      '#B78CBB', '#CE844F', '#679B47', '#6594B9', '#B65B78',
      '#589C9D', '#A47C3A', '#8D68AB', '#8F9E57', '#BC7666',
      '#6AABA4', '#A87FCA', '#AA6B8D', '#D1A555', '#638AB5',
      '#A67E66', '#8792C1'
    ];
    const random = core.makeRandom('colors-contraste-2-' + board.seed + '-' + board.size);
    // Com mais de 8 regiões, escolhe sucessivamente a cor mais distante de
    // todas as já escolhidas. A comparação é GLOBAL, não só entre vizinhas.
    const available = board.size <= essential.length ? essential.slice(0, board.size) : essential.slice();
    if (board.size > essential.length) {
      const rest = extra.slice();
      const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const distance = (a, b) => {
        const x = rgb(a), y = rgb(b);
        return Math.sqrt((x[0]-y[0])**2 + (x[1]-y[1])**2 + (x[2]-y[2])**2);
      };
      while (available.length < board.size && rest.length) {
        let best = 0, bestScore = -Infinity;
        for (let i = 0; i < rest.length; i++) {
          const nearest = Math.min(...available.map(c => distance(c, rest[i])));
          const score = nearest + random() * 0.001;
          if (score > bestScore) { bestScore = score; best = i; }
        }
        available.push(rest.splice(best, 1)[0]);
      }
    }
    const colors = core.shuffle(available, random);
    const adjacency = Array.from({ length: board.size }, () => new Set());
    const regionSizes = Array(board.size).fill(0);
    for (let i = 0; i < board.regions.length; i++) {
      const group = board.regions[i]; regionSizes[group]++;
      for (const next of core.neighbors(i, board.size)) {
        const other = board.regions[next];
        if (group !== other) { adjacency[group].add(other); adjacency[other].add(group); }
      }
    }
    const order = Array.from({ length: board.size }, (_, i) => i)
      .sort((a,b) => adjacency[b].size-adjacency[a].size || regionSizes[b]-regionSizes[a]);
    const chosen = Array(board.size).fill(-1);
    const used = new Set();
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const distance = (a, b) => {
      const x = rgb(a), y = rgb(b);
      return Math.sqrt((x[0]-y[0])**2 + (x[1]-y[1])**2 + (x[2]-y[2])**2);
    };
    for (const region of order) {
      let best = -1, bestScore = -Infinity;
      const neighboringColors = [...adjacency[region]].map(g => chosen[g]).filter(i => i >= 0);
      const globalColors = chosen.filter(i => i >= 0);
      for (let i = 0; i < colors.length; i++) {
        if (used.has(i)) continue;
        const localGap = neighboringColors.length
          ? Math.min(...neighboringColors.map(j => distance(colors[i], colors[j]))) : 250;
        const globalGap = globalColors.length
          ? Math.min(...globalColors.map(j => distance(colors[i], colors[j]))) : 250;
        // Regiões vizinhas têm prioridade, mas também não deixamos territórios
        // distantes parecerem a mesma cor, como na captura reportada.
        const score = localGap * 2 + globalGap + random() * 0.01;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      chosen[region] = best;
      used.add(best);
    }
    return chosen.map(index => colors[index]);
  }
  function buildBoard() {
    const b = game.board, n = b.size;
    palette = paletteFor(b);
    cellElements = [];
    dom.board.replaceChildren();
    dom.board.style.gridTemplateColumns = `repeat(${n}, var(--cell-size))`;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < n * n; i++) {
      const row = Math.floor(i / n), col = i % n;
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = i;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Linha ${row+1}, coluna ${col+1}, região ${b.regions[i]+1}, vazia`);
      cell.tabIndex = i === 0 ? 0 : -1;
      cell.style.setProperty('--region-color', palette[b.regions[i]]);
      const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
      icon.classList.add('cat-symbol');
      const use = document.createElementNS('http://www.w3.org/2000/svg','use');
      use.setAttribute('href','#i-cat'); icon.appendChild(use); icon.style.display = 'none';
      cell.appendChild(icon);
      // Ícone X desenhado com traços brancos de extremidade arredondada.
      const xIcon = document.createElementNS('http://www.w3.org/2000/svg','svg');
      xIcon.classList.add('x-symbol');
      xIcon.setAttribute('viewBox','0 0 24 24');
      xIcon.setAttribute('aria-hidden','true');
      const cross = document.createElementNS('http://www.w3.org/2000/svg','path');
      cross.setAttribute('d','M5 5 L19 19 M19 5 L5 19');
      xIcon.appendChild(cross);
      cell.appendChild(xIcon);
      fragment.appendChild(cell); cellElements.push(cell);
    }
    dom.board.appendChild(fragment);
    applyBoardSize();
  }
  // O tamanho inicial SEMPRE cabe na largura e na altura úteis da tela.
  // Em mapas grandes a célula pode ficar pequena; + / - permitem zoom
  // intencional, com deslocamento dentro do quadro (não da página).
  function applyBoardSize() {
    if (!game) return;
    const n = game.board.size;
    const scrollStyle = getComputedStyle(dom.scroll);
    const horizontalPadding = (parseFloat(scrollStyle.paddingLeft) || 0) +
      (parseFloat(scrollStyle.paddingRight) || 0);
    const width = Math.max(0, dom.scroll.clientWidth - horizontalPadding);
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    // Reserva um espaço para a barra de zoom e para o restante do navegador.
    const height = Math.max(125, Math.min(810, viewportHeight * .69 - 12));
    const gap = n >= 24 ? 1.2 : n >= 15 ? 1.7 : 3;
    const available = Math.max(0, Math.min(width, height));
    // 6px: borda branca de 3px em cada lado; 3px: margem contra arredondamentos.
    const base = Math.min(58, Math.max(1, (available - 9 - (n - 1) * gap) / n));
    const pixels = Math.max(1, Math.floor(base * zoom * 100) / 100);
    dom.board.style.setProperty('--cell-size', `${pixels}px`);
    dom.board.style.setProperty('--tile-gap', `${Math.round(gap * zoom * 100) / 100}px`);
    dom.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    dom.zoomOut.disabled = zoom <= .55;
    dom.zoomIn.disabled = zoom >= 3;
  }
  function autoBlocked(index) {
    if (!settings.autoX || !game || game.marks[index] !== 0) return false;
    const n = game.board.size, row = Math.floor(index / n), col = index % n;
    for (let i = 0; i < game.marks.length; i++) {
      if (game.marks[i] !== 2) continue;
      const r = Math.floor(i / n), c = i % n;
      if (r === row || c === col || game.board.regions[i] === game.board.regions[index] ||
          (Math.abs(r-row)<=1 && Math.abs(c-col)<=1)) return true;
    }
    return false;
  }
  function updateBoard() {
    if (!game || !cellElements.length) return;
    const n = game.board.size;
    const auto = new Uint8Array(n * n);
    if (settings.autoX) for (let i=0;i<game.marks.length;i++) if (game.marks[i]===2)
      for (const idx of core.forcedXCells(game.board, i)) auto[idx] = 1;
    let cats = 0;
    for (let i = 0; i < cellElements.length; i++) {
      const cell = cellElements[i], mark = game.marks[i];
      if (mark === 2) cats++;
      const isAuto = mark === 0 && !!auto[i];
      cell.classList.toggle('x',mark === 1 || isAuto);
      cell.classList.toggle('auto-x',isAuto);
      cell.classList.toggle('cat',mark === 2);
      cell.classList.toggle('hint-cell',i === highlighted);
      cell.classList.toggle('wrong-cell',i === recentError);
      const icon = cell.firstChild;
      icon.style.display = mark === 2 || i === recentError ? 'block' : 'none';
      cell.setAttribute('aria-label',`Linha ${Math.floor(i/n)+1}, coluna ${i%n+1}, região ${game.board.regions[i]+1}, ${mark===2?'gato':mark===1||isAuto?'X':'vazia'}`);
    }
    dom.cats.textContent = `${cats} / ${n}`;
    dom.hearts.textContent = '♥ '.repeat(3 - game.mistakes).trim() + (game.mistakes ? ' ♡'.repeat(game.mistakes) : '');
    dom.hearts.setAttribute('aria-label',`${3-game.mistakes} vidas restantes`);
    dom.timer.textContent = formatTime(game.elapsed);
    dom.sizeTag.textContent = `${n} × ${n}`;
    dom.difficultyTag.textContent = core.DIFFICULTY_NAMES[game.board.difficulty];
    dom.seed.textContent = game.board.seed;
    dom.undo.disabled = undoStack.length === 0 || game.completed || game.lost || loading;
    dom.redo.disabled = redoStack.length === 0 || game.completed || game.lost || loading;
    dom.hint.disabled = game.completed || game.lost || loading;
  }
  function updateGameUI() { updateBoard(); }
  function updateStats() {
    dom.played.textContent = stats.played;
    dom.wins.textContent = stats.wins;
    dom.mistakes.textContent = stats.mistakes;
    const key = game ? `${game.board.size}-${game.board.difficulty}` : `${settings.size}-${settings.difficulty}`;
    dom.best.textContent = stats.bests[key] == null ? '--:--' : formatTime(stats.bests[key]);
    dom.galleryBadge.textContent = history.length;
  }
  function snapshot() { return game ? game.marks.slice() : null; }
  function commitUndo(before) {
    if (!before || before.every((value, i) => value === game.marks[i])) return;
    undoStack.push(before);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
    queueSave();
  }
  function isActive() { return !!game && !loading && !game.completed && !game.lost; }
  function isSolutionCat(i) { return game.board.solution[Math.floor(i / game.board.size)] === (i % game.board.size); }
  function wrongMove(index) {
    game.mistakes++; stats.mistakes++;
    recentError = index;
    clearTimeout(recentErrorTimeout);
    recentErrorTimeout = setTimeout(() => { recentError = -1; updateBoard(); }, 510);
    playSound('wrong');
    if (game.mistakes >= 3) {
      game.lost = true; stats.losses++;
      message('Suas 3 vidas acabaram. Reinicie a fase e tente outra vez!', 'warning');
      finish(false);
    } else {
      message(`Esse gato caiu no lugar errado! Você ainda tem ${3-game.mistakes} vida${3-game.mistakes===1?'':'s'}.`, 'warning');
    }
    updateBoard(); updateStats(); queueSave();
  }
  function changeMark(index, next, isDrag = false) {
    if (!isActive()) return false;
    if (index < 0 || index >= game.marks.length) return false;
    if (next === 2 && !isSolutionCat(index)) { wrongMove(index); return false; }
    const old = game.marks[index];
    if (old === next) return false;
    game.marks[index] = next;
    if (next === 2) playSound('cat'); else if (!isDrag) playSound('mark');
    if (next === 2) message('Miau! Mais um gatinho no lugar certo. 🐱','success');
    if (next === 0) message('Casinha limpa. Pode pensar de novo!');
    if (!isDrag && next === 1) message('X marcado! Um segundo clique rápido coloca o gato; um clique depois apaga o X.');
    if (core.validatePlacement(game.board, game.marks)) {
      game.completed = true; stats.wins++;
      const key = `${game.board.size}-${game.board.difficulty}`;
      if (stats.bests[key] == null || game.elapsed < stats.bests[key]) stats.bests[key] = game.elapsed;
      message('Todos os gatos foram encontrados! Miauravilhoso! 🏆','success');
      finish(true);
    }
    updateBoard(); updateStats(); queueSave();
    return true;
  }
  // O intervalo entre dois toques não é um ciclo de estados permanente:
  // um clique isolado em X sempre apaga a marca. Só um duplo clique rápido faz gato.
  const DOUBLE_CLICK_MS = 345;
  const DOUBLE_TOUCH_MS = 425;
  let previousTap = null;
  function resetTap() { previousTap = null; }
  function clickCell(index, pointerType = 'mouse') {
    if (!isActive()) return;
    const time = performance.now();
    const timeout = pointerType === 'touch' || pointerType === 'pen' ? DOUBLE_TOUCH_MS : DOUBLE_CLICK_MS;
    const isDoubleTap = previousTap && previousTap.index === index &&
      previousTap.pointerType === pointerType && time - previousTap.time <= timeout;
    resetTap();
    if (isDoubleTap) {
      if (autoBlocked(index)) return;
      const before = snapshot();
      if (changeMark(index, 2)) commitUndo(before);
      return;
    }
    if (game.marks[index] === 0 && autoBlocked(index)) {
      message('Esta casa está marcada automaticamente por outro gato. Desligue o X automático para mudar isso.', 'warning');
      return;
    }
    const before = snapshot();
    const oldMark = game.marks[index];
    // Vazio -> X; X -> vazio; gato -> vazio. Nenhum ciclo X -> gato por clique lento.
    if (changeMark(index, oldMark === 0 ? 1 : 0)) {
      commitUndo(before);
      if (oldMark !== 2) previousTap = { index, time, pointerType };
    }
  }
  function setCatDirect(index) {
    resetTap();
    if (!isActive()) return;
    if (autoBlocked(index)) return;
    const before=snapshot();
    if (changeMark(index,game.marks[index]===2?0:2)) commitUndo(before);
  }
  function toggleXFromDrag(index, gesture) {
    if (!isActive() || index < 0 || index >= game.marks.length || gesture.visited.has(index)) return;
    gesture.visited.add(index); // Passar novamente pela mesma casa não a desfaz duas vezes.
    if (game.marks[index] === 2) return;
    if (game.marks[index] === 0 && autoBlocked(index)) return;
    changeMark(index, game.marks[index] === 1 ? 0 : 1, true);
  }
  function finish(won) {
    const entry = history.find(h => sameConfig(h.board, game.board));
    if (entry) { entry.finished = won; entry.record = won ? game.elapsed : entry.record; }
    queueSave();
    updateStats();
    setTimeout(() => {
      if (!game || !game.completed && !game.lost) return;
      el('resultIcon').textContent = won ? '🎉' : '💔';
      el('resultEyebrow').textContent = won ? 'MISSÃO CUMPRIDA' : 'FIM DAS VIDAS';
      el('resultTitle').textContent = won ? 'Miauravilhoso!' : 'Os gatos venceram desta vez!';
      el('resultDescription').textContent = won ? 'Todos os gatinhos encontraram seu cantinho. Que orgulho das patinhas!'
        : 'Três gatos no lugar errado! O tabuleiro continua disponível para você tentar de novo.';
      el('resultTime').textContent = formatTime(game.elapsed);
      el('resultMistakes').textContent = game.mistakes;
      el('resultHints').textContent = game.hints;
      if (!dom.resultDialog.open) dom.resultDialog.showModal();
      if (won) playSound('victory');
    }, 380);
  }
  function restart() {
    if (!game || loading) return;
    game.marks = Array(game.board.size * game.board.size).fill(0);
    game.elapsed = 0; game.mistakes = 0; game.hints = 0; game.completed = false; game.lost = false;
    game.startedAt = Date.now();
    undoStack = []; redoStack = []; highlighted = -1; recentError = -1; resetTap();
    if (dom.resultDialog.open) dom.resultDialog.close();
    message('Nova chance! Todos os gatos ainda estão esperando por você. 🐾');
    updateBoard(); queueSave();
  }
  function undo() {
    if (!isActive() || !undoStack.length) return;
    resetTap();
    redoStack.push(snapshot()); game.marks = undoStack.pop();
    message('Última marcação desfeita.'); updateBoard(); queueSave();
  }
  function redo() {
    if (!isActive() || !redoStack.length) return;
    resetTap();
    undoStack.push(snapshot()); game.marks = redoStack.pop();
    message('Marcação refeita.'); updateBoard(); queueSave();
  }
  function showHint() {
    if (!isActive()) return;
    const hint = core.findHint(game.board, game.marks);
    if (!hint) { message('Você já encontrou todos os gatinhos!'); return; }
    game.hints++;
    highlighted = hint.index;
    message('💡 ' + hint.message, 'success');
    playSound('hint'); updateBoard();
    const cell = cellElements[highlighted];
    if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    setTimeout(() => { highlighted = -1; updateBoard(); }, 3400);
    queueSave();
  }
  function cellAtPointer(event) {
    const found = document.elementFromPoint(event.clientX,event.clientY);
    const cell = found && found.closest('.cell');
    return cell && dom.board.contains(cell) ? Number(cell.dataset.index) : -1;
  }
  function setupPointerControls() {
    dom.board.addEventListener('pointerdown', event => {
      if (event.button === 2 || !isActive()) return;
      const idx = cellAtPointer(event);
      if (idx < 0) return;
      event.preventDefault();
      dragging = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY,
        lastX:event.clientX, lastY:event.clientY, start:idx, dragged:false, before:null,
        scrollX:dom.scroll.scrollLeft, scrollY:dom.scroll.scrollTop, pan:panMode,
        pointerType:event.pointerType || 'mouse', visited:new Set() };
      try { dom.board.setPointerCapture(event.pointerId); } catch (_) {}
    });
    dom.board.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== dragging.pointerId || !isActive()) return;
      const dx = event.clientX-dragging.startX, dy = event.clientY-dragging.startY;
      if (dragging.pan) {
        if (Math.hypot(dx,dy)>4) dragging.dragged=true;
        dom.scroll.scrollLeft = dragging.scrollX - dx;
        dom.scroll.scrollTop = dragging.scrollY - dy;
        return;
      }
      if (!dragging.dragged && Math.hypot(dx,dy)>7) {
        dragging.dragged=true; dragging.before=snapshot();
        resetTap();
        toggleXFromDrag(dragging.start, dragging);
      }
      if (dragging.dragged) {
        // Preenche todos os quadrados cruzados pelo gesto (mesmo com movimento rápido).
        const dist=Math.hypot(event.clientX-dragging.lastX,event.clientY-dragging.lastY);
        const steps=Math.max(1,Math.ceil(dist/Math.max(8,parseInt(dom.board.style.getPropertyValue('--cell-size'))/3)));
        for(let s=0;s<=steps;s++){
          const x=dragging.lastX+(event.clientX-dragging.lastX)*s/steps;
          const y=dragging.lastY+(event.clientY-dragging.lastY)*s/steps;
          const node=document.elementFromPoint(x,y);
          const cell=node&&node.closest('.cell');
          if(cell&&dom.board.contains(cell))toggleXFromDrag(Number(cell.dataset.index), dragging);
        }
      }
      dragging.lastX=event.clientX;dragging.lastY=event.clientY;
    });
    function endPointer(event) {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      const gesture=dragging; dragging=null;
      if (gesture.pan) return;
      if (gesture.dragged) {
        commitUndo(gesture.before); queueSave(); message('Marcações atualizadas com o arrasto! 🐾');
      } else if (event.type==='pointerup') clickCell(gesture.start, gesture.pointerType);
    }
    dom.board.addEventListener('pointerup',endPointer);
    dom.board.addEventListener('pointercancel',endPointer);
    dom.board.addEventListener('contextmenu',event => {
      const cell = event.target.closest('.cell');
      if (!cell) return;
      event.preventDefault(); setCatDirect(Number(cell.dataset.index));
    });
    dom.board.addEventListener('keydown',event=>{
      const target=event.target.closest('.cell');
      if (!target) return;
      const idx=Number(target.dataset.index),n=game.board.size;
      if (event.key===' '||event.key==='Enter'){event.preventDefault();clickCell(idx, 'keyboard');return;}
      const offsets={ArrowUp:-n,ArrowDown:n,ArrowLeft:-1,ArrowRight:1};
      if(offsets[event.key]===undefined)return;
      event.preventDefault();let next=idx+offsets[event.key];
      if((event.key==='ArrowLeft'&&idx%n===0)||(event.key==='ArrowRight'&&idx%n===n-1)||next<0||next>=n*n)return;
      target.tabIndex=-1;cellElements[next].tabIndex=0;cellElements[next].focus();
    });
  }
  function zoomBy(change){
    zoom = Math.min(3, Math.max(.55, Math.round((zoom + change) * 100) / 100));
    applyBoardSize();
  }
  function fitBoard() {
    zoom = 1;
    dom.scroll.scrollLeft = 0;
    dom.scroll.scrollTop = 0;
    applyBoardSize();
  }
  function openGallery() { renderGallery(); if (!dom.galleryDialog.open) dom.galleryDialog.showModal(); }
  function renderGallery() {
    const term=dom.gallerySearch.value.toLowerCase().trim();
    const matches=history.filter(entry => {
      const b=entry.board;
      return `${b.size}x${b.size} ${b.size}×${b.size} ${b.seed} ${b.difficulty}`.toLowerCase().includes(term);
    });
    dom.galleryList.replaceChildren();
    if (!matches.length) {const note=document.createElement('div');note.className='empty-gallery';note.innerHTML='<span>📭</span> Nenhuma fase por aqui ainda! Gere uma para começar sua coleção.';dom.galleryList.append(note);return;}
    for(const entry of matches){
      const b=entry.board, card=document.createElement('article');card.className='gallery-card';
      const thumb=document.createElement('div');thumb.className='gallery-mini';
      const detail=Math.min(b.size,9);thumb.style.gridTemplateColumns=`repeat(${detail},1fr)`;
      const colors=paletteFor(b);
      for(let row=0;row<detail;row++)for(let col=0;col<detail;col++){
        const i=document.createElement('i');
        const rr=Math.floor(row*b.size/detail),cc=Math.floor(col*b.size/detail);
        i.style.background=colors[b.regions[rr*b.size+cc]];thumb.append(i);
      }
      const meta=document.createElement('div');meta.className='gallery-card-meta';
      const heading=document.createElement('strong');heading.textContent=`${b.size}×${b.size} · ${core.DIFFICULTY_NAMES[b.difficulty]}`;
      const detailText=document.createElement('small');detailText.textContent=`${entry.finished?'🏆 Concluída':'🐾 Guardada'} · ${new Date(entry.createdAt).toLocaleDateString('pt-BR')}`;
      const code=document.createElement('code');code.textContent=b.seed;
      const button=document.createElement('button');button.type='button';button.textContent='Abrir fase →';
      button.addEventListener('click',()=>{dom.galleryDialog.close();newGame(b,true);});
      meta.append(heading,detailText,code,button);card.append(thumb,meta);dom.galleryList.append(card);
    }
  }
  async function shareGame() {
    if (!game) return;
    const url=new URL(window.location.href);
    url.searchParams.set('n',game.board.size);url.searchParams.set('d',game.board.difficulty);url.searchParams.set('seed',game.board.seed);
    try { await navigator.clipboard.writeText(url.toString());showToast('Link da fase copiado! Compartilhe as patinhas. 🐾'); }
    catch(_){
      const input=document.createElement('textarea');input.value=url.toString();document.body.append(input);input.select();
      try{document.execCommand('copy');showToast('Link da fase copiado! 🐾');}catch(__){prompt('Copie o link da fase:',url.toString());}
      input.remove();
    }
  }
  function wireEvents() {
    dom.sizes.addEventListener('click',event=>{const btn=event.target.closest('[data-size]');if(btn){changeSize(btn.dataset.size);dom.size.value=settings.size;}});
    dom.size.addEventListener('input',()=>changeSize(dom.size.value));
    dom.size.addEventListener('change',()=>{
      const n=Number(dom.size.value);
      if(!Number.isInteger(n)||n<core.MIN_SIZE||n>core.MAX_SIZE){showToast(`O tamanho deve ser de ${core.MIN_SIZE} a ${core.MAX_SIZE}.`);return;}
      settings.size=n;updateSettingsUI();saveSettings();
    });
    dom.difficulties.addEventListener('click',event=>{const btn=event.target.closest('[data-difficulty]');if(!btn)return;settings.difficulty=btn.dataset.difficulty;updateSettingsUI();saveSettings();});
    dom.generate.addEventListener('click',()=>newGame({size:settings.size,difficulty:settings.difficulty,seed:core.randomSeed()}));
    dom.autoX.addEventListener('change',()=>{settings.autoX=dom.autoX.checked;saveSettings();updateBoard();showToast(settings.autoX?'X automático ligado!':'X automático desligado.');});
    dom.theme.addEventListener('click',()=>{settings.dark=!settings.dark;saveSettings();updateSettingsUI();});
    dom.sound.addEventListener('click',()=>{settings.sound=!settings.sound;saveSettings();updateSettingsUI();if(settings.sound)playSound('cat');});
    dom.undo.addEventListener('click',undo); dom.redo.addEventListener('click',redo);
    dom.reset.addEventListener('click',restart);dom.hint.addEventListener('click',showHint);
    dom.share.addEventListener('click',shareGame);
    dom.zoomIn.addEventListener('click',()=>zoomBy(.15));dom.zoomOut.addEventListener('click',()=>zoomBy(-.15));
    el('zoomFit').addEventListener('click',fitBoard);
    dom.pan.addEventListener('click',()=>{panMode=!panMode;dom.pan.classList.toggle('active',panMode);dom.pan.setAttribute('aria-pressed',String(panMode));resetTap();showToast(panMode?'Modo mover: arraste para deslocar o tabuleiro.':'Modo marcar: arraste para marcar ou apagar X.');});
    [el('openGallery'),el('sideGalleryBtn')].forEach(btn=>btn.addEventListener('click',openGallery));
    el('gallerySearch').addEventListener('input',renderGallery);
    el('clearHistoryBtn').addEventListener('click',()=>{
      if(!history.length)return;
      if(!confirm('Apagar a galeria de fases deste navegador? A partida atual continuará salva.'))return;
      history=[];persist();updateStats();renderGallery();showToast('Galeria apagada.');
    });
    document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>el(button.dataset.close).close()));
    el('resultNewBtn').addEventListener('click',()=>{dom.resultDialog.close();newGame({size:game.board.size,difficulty:game.board.difficulty,seed:core.randomSeed()});});
    el('resultRetryBtn').addEventListener('click',restart);
    document.addEventListener('keydown',event=>{
      const textInput=event.target.closest('input,textarea,[contenteditable]');
      if(textInput||!game||dom.galleryDialog.open||dom.resultDialog.open)return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
    });
    window.addEventListener('resize',applyBoardSize);
    window.addEventListener('orientationchange',applyBoardSize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize',applyBoardSize);
    // Também responde a alterações na largura do painel sem resize da janela.
    if (typeof ResizeObserver !== 'undefined') {
      let lastPanelWidth = 0;
      const panelObserver = new ResizeObserver(entries => {
        const newWidth = entries[0] && entries[0].contentRect.width;
        if (newWidth && Math.abs(newWidth - lastPanelWidth) > .5) {
          lastPanelWidth = newWidth;
          requestAnimationFrame(applyBoardSize);
        }
      });
      panelObserver.observe(dom.frame);
    }
    window.addEventListener('beforeunload',()=>{clearTimeout(saveTimeout);persist();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(saveTimeout);persist();}});
    setupPointerControls();
  }
  async function boot(){
    updateSettingsUI();wireEvents();
    const urlConfig=settingsFromURL();
    const savedGame=validSavedGame(persisted.game)?persisted.game:null;
    if(savedGame&&(!urlConfig||sameConfig(savedGame.board,urlConfig))){
      initGameFromBoard(savedGame.board,savedGame);
    } else {
      const config=urlConfig||core.normalizedConfig({size:settings.size,difficulty:settings.difficulty,seed:core.randomSeed()});
      await newGame(config,false);
    }
    timerInterval=setInterval(()=>{
      if(game&&!game.completed&&!game.lost&&!loading&&!document.hidden){game.elapsed++;dom.timer.textContent=formatTime(game.elapsed);if(game.elapsed%5===0)queueSave();}
    },1000);
  }
  boot().catch(err=>{console.error(err);showToast('Falha ao iniciar Meowdoku. Confira o console do navegador.');});
})();
