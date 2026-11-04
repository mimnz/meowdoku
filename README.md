# 🐱 Meowdoku

Um jogo de lógica inspirado nas regras de *Queens / Meowdoku*, construído em **HTML, CSS e JavaScript puro**, sem framework, sem cadastro, sem banco de dados, sem dependências obrigatórias e sem requisições para APIs.

## Como testar

1. Extraia o arquivo `.zip`.
2. Abra a pasta `meowdoku`.
3. Dê dois cliques em **`index.html`**. O jogo pode funcionar diretamente no navegador, inclusive sem internet.
4. Escolha o tamanho (4×4 até 30×30), a dificuldade e clique em **Gerar nova fase**.

Se seu navegador restringir armazenamento, a URL de arquivo local ou a cópia de links no modo `file://`, rode um servidor estático opcional para testes:

```bash
cd meowdoku
python -m http.server 8000
```

Abra `http://localhost:8000`. **Não é um servidor de aplicação**: apenas entrega os mesmos arquivos estáticos. Pode publicar os arquivos em qualquer hospedagem estática, sem PHP nem MySQL.

## Como jogar

- Exatamente **um gato por linha**, **um por coluna** e **um por região colorida**.
- Gatos **não podem se tocar**, inclusive nos quadrados diagonalmente adjacentes.
- **1 clique / 1 toque:** alterna a casa entre vazio e X. Clicar em um X já marcado apaga o X.
- **Dois cliques rápidos / toques na mesma casa:** tenta colocar gato (janela curta de duplo clique).
- **1 clique em um gato:** remove o gato.
- **Arrastar mouse ou dedo:** alterna X nas casas atravessadas (vazia → X; X → vazia); cada casa é processada apenas uma vez por gesto. Gatos já colocados permanecem intactos.
- **Clique direito:** coloca ou remove gato diretamente.
- Um gato fora da **solução única** da fase custa **uma vida**, mesmo quando ainda não viola uma regra visível. Com **três erros**, a partida acaba e pode ser reiniciada.
- É possível ativar X automático para marcar todas as casas impossíveis após colocar um gato correto.

### Cores das regiões

Cada território possui um **identificador lógico próprio**, independente da cor usada para desenhá-lo. Para tabuleiros de até **8×8**, a paleta usa famílias de cores diferentes, com contraste mínimo testado para impedir a confusão entre territórios (mesmo quando estão afastados). Em tabuleiros maiores, o algoritmo seleciona novas tonalidades priorizando o contraste global e entre territórios vizinhos.

A correção de cores **não altera a seed, o mapa, a resposta nem os dados salvos**. A galeria utiliza a mesma paleta corrigida ao renderizar as miniaturas. O teste `tests/test-color-regression.py` reconstrói o mapa da captura que motivou a correção.

O tabuleiro se ajusta automaticamente à tela de celulares, tablets e computadores, inclusive ao girar o dispositivo. Em tabuleiros grandes, as células ficam menores para caber completamente na tela; use os botões `−` e `+` para ampliar ou reduzir e **⤢** para ajustar novamente. O botão **✥** ativa o **modo mover** para deslocar o tabuleiro arrastando (toque ou mouse). Clique novamente para voltar a marcar X.

## Fases proceduralmente geradas e verificadas

O algoritmo cria uma solução inicial, forma uma partição conectada em `N` regiões e expande essas regiões preservando a solução única. Toda expansão aceita é testada com um **solucionador independente**, que interrompe a contagem quando encontra duas soluções. Ao terminar, um último teste verifica os limites, a conectividade e a solução única.

**Nenhum mapa é exibido se falhar na validação.** A seed, o tamanho, o nível escolhido e a versão do algoritmo determinam o tabuleiro. A mesma combinação reproduz o mesmo mapa e a mesma solução, inclusive em outro dispositivo com esta versão do código.

> **Dificuldade:** o gerador varia quanto expande as regiões, de acordo com a dificuldade solicitada. O cálculo da complexidade é **heurístico**, não uma prova de dificuldade humana exata. Em tabuleiros grandes ou configurações difíceis, a expansão é reduzida de propósito para preservar a velocidade e a garantia de unicidade. Um problema com solução única pode exigir deduções por contradição; esta versão não inclui um avaliador pedagógico completo que categorize técnicas humanas de resolução.

### Link de fase

Após gerar, a URL terá a forma:

```
https://seusite.com/index.html?n=8&d=medio&seed=SEU-CODIGO
```

Basta compartilhar o link. O jogo regenera a mesma fase com a mesma seed. **Importante:** links `file://` apontam para arquivos no computador e não podem ser compartilhados como links públicos. Para isso, publique o site em uma hospedagem estática.

## O que é salvo

Tudo fica no `localStorage` do navegador. Não é transmitido para lugar nenhum.

- Fase atual e suas marcações, com cronômetro, erros e dicas.
- Preferências de interface, tema, sons e X automático.
- Número de partidas, vitórias, derrotas e erros acumulados.
- Melhor tempo por **tamanho + dificuldade**.
- Galeria com até **80 mapas** gerados, incluindo seed, regiões e solução.

A galeria guarda os mapas para revisitá-los, **não** o progresso individual de todas as partidas antigas. Apenas a **partida atual** é retomada do ponto em que você parou ao recarregar. Apagar os dados do site no navegador apaga esses registros.

## Arquivos

```
meowdoku/
├── index.html            # Interface do site
├── css/style.css         # Visual e responsividade
├── js/core.js            # Geração, solucionador e validação
├── js/app.js             # Interação, desenho do mapa e localStorage
├── assets/favicon.svg    # Ícone do site
├── assets/audio/         # Efeitos sonoros WAV originais e substituíveis
│   ├── mark.wav
│   ├── cat.wav
│   ├── wrong.wav
│   ├── hint.wav
│   └── victory.wav
├── tests/test-core.js    # Teste automatizado, sem dependências (Node.js)
├── tests/test-color-regression.py # Regressão de cores/territórios da captura
├── tests/test-browser.py      # Fluxo completo (Playwright + Chromium)
├── tests/test-interactions.py # Gestos, double click, X e toque (Playwright)
├── REGRAS.md             # Checklist de requisitos
└── README.md
```

### Trocar os sons

Substitua os arquivos `.wav` em `assets/audio/` mantendo **exatamente os nomes** acima. Os sons que acompanham o projeto são sintetizados e originais. Sem licenciamento de áudio de terceiros.

### Rodar testes

O jogo em si **não** precisa de Node.js. Para testar a lógica com Node instalado:

```bash
node tests/test-core.js
```

O teste de navegador é opcional e requer Playwright + Chromium instalados no ambiente de testes. Ele injeta HTML/JS em uma página de teste, sem acessar servidores externos.

## Limites e escolhas desta entrega

- Tabuleiros quadrados **4×4 a 30×30**. Acima de 30 há limitações de interface, memória e desempenho; não foi disponibilizado na UI.
- Não existem gatos iniciais nem modo livre sem vidas.
- **Dica** destaca uma casa da solução única ou corrige um X que esconde um gato. Quando possível, explica uma dedução simples; em outros casos, a indicação é uma pista, não uma aula passo a passo.
- O gerador prioriza **soluções válidas e exclusivas**, mesmo que isso reduza a variedade dos tamanhos das regiões, especialmente nos tabuleiros grandes.
- Não há banco de dados, contas, sincronização entre dispositivos ou anúncios.

## Observação de autoria

Jogo independente, inspirado nas regras do quebra-cabeça Meowdoku/Queens. Não é um produto oficial nem afiliado à Oakever Games. Interface e sons deste pacote são próprios, sem copiar assets do aplicativo original.

## Revisão visual e gestos

- Territórios exibidos com **cores mais vivas** e separação **branca e uniforme** entre todas as células, sem bordas grossas.
- X branco, arredondado (SVG com traços de pontas redondas), maior e com animação de pop ao marcar.
- Clique isolado no X remove a marca; **somente dois cliques rápidos na mesma casa** colocam o gato (345 ms mouse, 425 ms toque). Clique lento não vira gato.
- Arrastar sobre casas marcadas remove os X e sobre vazias adiciona X. O mesmo gesto não alterna uma casa duas vezes por engano.

### Responsividade para celular e tablet

- Ao abrir uma fase, o **mapa completo se encaixa na área visível**, tanto em retrato quanto em paisagem, inclusive em iPads/tablets e celulares estreitos.
- O tamanho de cada célula é calculado a partir da largura interna do painel, da altura disponível e do número de casas, sem tamanho mínimo que force o mapa a ultrapassar a tela.
- Em 20×20 ou 30×30, as casas podem ficar pequenas: use **+** para ampliar e **✥** para mover o mapa ampliado. O botão **⤢** retorna ao enquadramento completo.
- O tabuleiro se reajusta quando a tela é girada, redimensionada ou quando a área do painel muda de tamanho.
- Teste automatizado opcional: `python tests/test-responsive.py` (requer Playwright e Chromium). Não é necessário para jogar.
