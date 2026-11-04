# Meowdoku · Regras e checklist da implementação

| ID | Regra / recurso | Implementação |
| --- | --- | --- |
| R01 | Exatamente 1 gato por linha | ✅ validação de vitória e solucionador |
| R02 | Exatamente 1 gato por coluna | ✅ validação de vitória e solucionador |
| R03 | Exatamente 1 gato por região | ✅ validação de vitória e solucionador |
| R04 | Não tocar nem diagonalmente | ✅ validação e solucionador |
| R05 | N gatos em NxN | ✅ |
| R06 | Detectar vitória | ✅ tela e estatísticas |
| T01-T04 | Quadrado, entrada personalizada, mínimo 4 | ✅ |
| T05 | Máximo coerente com desempenho | ✅ 30 |
| T06-T07 | Responsividade, zoom e pan | ✅ |
| G01-G03 | Geração aleatória com solução | ✅ |
| G04 | Exatamente uma solução | ✅ verificação independente |
| G05-G08 | Regiões variadas, conectadas, N regiões, 1 gato cada | ✅ |
| G09-G10 | Verificar e gerar novos mapas | ✅ |
| G11 | Dificuldade ajustável | 🟡 via expansão das regiões, heurística, sem classificação humana exata |
| G12 | Resolução lógica | 🟡 unicidade provada; não há catálogo completo de estratégias humanas |
| C01-C03 | X / limpar por clique; gato apenas com duplo clique rápido | ✅ |
| C04 | Clique direito coloca/retira gato | ✅ |
| C05-C06 | Desfazer e refazer | ✅ |
| C07-C08 | Reiniciar e gerar fase | ✅ |
| C09-C10 | Contagem de gatos e conclusão | ✅ |
| E01-E04 | 3 erros, penalização, fim e reinício | ✅ erro = gato fora da solução |
| E05 | Modo livre | ⛔ não incluído, conforme pedido |
| D01-D06 | Dicas sem movimentos falsos | ✅ revelação de dedução/casa correta; explicação humana avançada não implementada |
| V01-V10 | Visual, cores, bordas, gatos, animações, responsivo, zoom e tema | ✅ |
| F01 | Cronômetro local | ✅ |
| F02 | Estatísticas locais | ✅ |
| F03 | Recordes por tamanho e dificuldade | ✅ |
| F04 | Salvar partida atual | ✅ |
| F05 | Seed na URL | ✅ query string, compatível com site estático |
| F06 | Tela de vitória | ✅ |
| F07 | Sons WAV substituíveis | ✅ |
| F08 | Modo livre sem erros | ⛔ não incluído, conforme pedido |
| F09 | Gatos iniciais | ⛔ não incluído, conforme pedido |
| F10 | Galeria com mapas salvos | ✅ até 80 mapas |
| P01-P03 | Motor separado, validador e solucionador | ✅ `core.js` |
| P04-P05 | Não aceitar fase inválida, limitar a geração | ✅ cap determinístico de tentativas e nós |
| P06-P07 | Estado separado, regras isoladas | ✅ |
| P08-P09 | Mouse, toque e testes automatizados | ✅ |
| P10 | Seed reproduzível | ✅ |

## Decisões complementares

1. **Controle de erro:** tentativa de gato que não pertence à solução validada custa uma vida, mesmo antes de haver um conflito visível.
2. **Marcações automáticas:** não substituem as marcações manuais; ao retirar um gato, as marcações automáticas correspondentes desaparecem.
3. **Arrasto:** alterna X/vazio em cada casa visitada uma única vez. Casas com gato não são sobrescritas.
4. **Dificuldade:** tabuleiros grandes podem ter layouts mais simples para manter o tempo de geração sob controle. A seleção define a intensidade *desejada*, não uma garantia de grau pedagógico.
5. **Histórico:** guarda mapas; não guarda múltiplos estados de jogo ao mesmo tempo.
6. **Sem backend:** sem PHP, MySQL, serviços de terceiros ou bibliotecas remotas.

7. **Visual:** separadores brancos uniformes entre células, regiões sem bordas reforçadas, paleta mais saturada e X branco arredondado com animação de entrada.
8. **Clique duplo:** a marcação em gato só ocorre dentro de uma janela curta de tempo na mesma casa; fora dela, clicar em X apaga X.

## Correção de cores e regiões (04/11/2026)

- Cada região é identificada por um ID lógico; sua cor é exclusivamente visual.
- Até 8 territórios, as cores devem pertencer a famílias distintas e ter contraste entre TODAS as regiões, não apenas as que encostam.
- Galeria e tabuleiro devem usar a mesma função de paleta.
- As seeds e os jogos salvos não mudam com atualizações da paleta.
- A captura de referência (8×8) foi reconstruída e testada, confirmando uma única solução; a confusão surgiu de dois azuis muito parecidos na paleta anterior.
