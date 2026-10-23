# Roteiro focado em fotogrametria — Photo3DEsay

## Objetivo atual

Construir primeiro um pipeline de fotogrametria confiável e mensurável: fotografias de entrada → calibração/estimativa de câmeras → correspondências → reconstrução esparsa → reconstrução densa → malha → textura. Recursos complementares só entram depois que a cadeia fotogramétrica entregar resultados reproduzíveis.

## Regras de desenvolvimento

- Trabalhar primeiro em Linux; não criar build de Windows nesta etapa.
- Rust + Tauri coordenam tarefas e exibem eventos; TypeScript/React é a interface; Python orquestra ferramentas fotogramétricas.
- COLMAP é o motor base para SfM e reconstrução esparsa.
- Usar CPU como linha de base reproduzível. Detecção da Intel Arc ou disponibilidade do PyTorch XPU não equivale a aceleração COLMAP.
- Não afirmar uma reconstrução como bem-sucedida só porque o processo terminou: conferir o modelo produzido e registrar as métricas disponíveis.
- Cada etapa tem testes unitários, teste de integração com COLMAP e um dataset de referência antes de avançar.
- Manter recursos, opções e mensagens em português; não inventar percentuais de progresso.

## Fase 1 — Preparação e registro esparso

**Estado:** em desenvolvimento.

- [x] Estrutura do app desktop e worker.
- [x] Validação básica da pasta e mínimo de duas imagens.
- [x] Pipeline COLMAP CPU: extração de características, correspondência e mapper.
- [x] Opção de correspondência exaustiva ou sequencial, apropriada a diferentes tipos de captura.
- [ ] Melhorar relatório de diagnóstico de imagens: arquivos ilegíveis, dimensões, duplicatas e avisos sobre fotos com pouca informação.
- [ ] Exibir número de imagens registradas versus total e quantidade de pontos 3D.
- [ ] Criar teste de integração com um dataset pequeno, versionado ou obtido de fonte redistribuível documentada.
- [ ] Confirmar CI Linux verde em Python, TypeScript e Rust e executar uma reconstrução real no computador-alvo.

**Critério de saída:** o dataset de referência conclui SfM; modelo, número de câmeras registradas, pontos 3D, logs e duração ficam registrados. Falhas devem identificar a etapa que parou.

## Fase 2 — Qualidade da reconstrução esparsa

- [ ] Inspecionar o modelo resultante com ferramentas do COLMAP e extrair métricas verificáveis.
- [ ] Identificar imagens não registradas e componentes desconectados.
- [ ] Permitir ajuste seguro da estratégia de correspondência e parâmetros que afetem tempo, RAM e qualidade.
- [ ] Adicionar retomada/limpeza de execução interrompida sem destruir projetos existentes.
- [ ] Gerar relatório de execução (parâmetros, versão COLMAP, fotos de entrada, fotos registradas, pontos e advertências).

**Critério de saída:** resultados repetíveis e relatório suficiente para comparar parâmetros em datasets de referência.

## Fase 3 — Reconstrução densa

- [ ] Detectar, por comando e teste funcional, se a instalação do COLMAP oferece PatchMatch Stereo e qual backend de GPU é suportado.
- [ ] Executar undistortion → mapas de profundidade/normais → fusão em nuvem densa.
- [ ] Configurar limites de resolução e cache para controlar RAM, disco e VRAM.
- [ ] Comparar densidade, cobertura, tempo e consumo contra um dataset de referência.
- [ ] Avaliar OpenMVS ou outra ferramenta complementar para sistemas sem backend compatível com a GPU disponível.

**Regra de compatibilidade:** não presumir que Intel Arc, PyTorch XPU ou um pacote COLMAP com CPU habilitem PatchMatch Stereo. Se o backend não for suportado, explicar a limitação e usar apenas um caminho alternativo que tenha sido instalado e validado.

**Critério de saída:** nuvem densa válida em arquivo PLY e métricas verificadas; o erro de falta de suporte precisa ser apresentado antes da execução longa sempre que puder ser detectado.

## Fase 4 — Malha e texturização

- [ ] Gerar malha de superfície a partir da nuvem densa.
- [ ] Avaliar qualidade, buracos, normais, componentes e densidade de triângulos.
- [ ] Texturizar a malha usando as imagens e câmeras registradas; reduzir costuras e áreas sem cobertura.
- [ ] Exportar e reabrir arquivos de teste (PLY, OBJ/MTL e outros formatos selecionados).
- [ ] Preservar os artefatos intermediários e registrar parâmetros de cada etapa.

**Critério de saída:** malha com textura que abre num visualizador independente, com checagem de integridade automatizada.

## Fase 5 — Inspeção visual e fluxo de projeto

- [ ] Visualizador 3D interativo para nuvem esparsa/densa e malha: orbitar, pan, zoom e enquadrar.
- [ ] Inspeção de câmeras registradas/não registradas e de fotografias associadas.
- [ ] Importação/organização de imagens e configuração do projeto mais segura.
- [ ] Cancelamento de tarefa e retomada com estado inequívoco.

Esta fase serve o pipeline fotogramétrico e não deve atrasar a validação da reconstrução.

## Fase 6 — Desempenho e validação

- [ ] Dataset pequeno, médio e grande com medições reproduzíveis de qualidade, tempo, RAM, CPU, GPU e espaço em disco.
- [ ] Ajustar resolução de imagens, número de características, estratégia de correspondência e cache baseado em medições.
- [ ] Investigar aceleração Intel Arc por caminho oficialmente suportado e comparar os resultados com CPU.
- [ ] Documentar dependências, backend, limitações e formas de reprodução de cada teste.

## Em espera

Gaussian Splatting, ortofotos, DSM/DTM, ferramentas de medição, LiDAR, processamento geoespacial avançado, recursos de colaboração e empacotamento final ficam em backlog até a cadeia SfM → nuvem densa → malha → textura ser confiável.

## Estado real

O repositório ainda está em fase inicial: tem um worker COLMAP para SfM esparso e não está no nível funcional de um produto fotogramétrico maduro. A paridade será medida funcionalidade por funcionalidade, com testes e datasets; não será declarada apenas por existir uma interface semelhante.
