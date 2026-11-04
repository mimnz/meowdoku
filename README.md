# 🐱 Meowdoku

Um jogo de lógica inspirado nas regras de *Queens / Meowdoku*, construído em **HTML, CSS e JavaScript puro**, sem framework, sem cadastro, sem banco de dados, sem dependências obrigatórias e sem requisições para APIs.

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
