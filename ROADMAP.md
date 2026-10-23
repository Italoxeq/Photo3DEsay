# Roadmap de produto — Photo3DEsay

## Objetivo

Construir um aplicativo desktop profissional de fotogrametria, com Linux como plataforma inicial de desenvolvimento e validação, mirando amplitude funcional comparável à de soluções maduras como 3DF Zephyr. A meta é funcionalidade verificável e qualidade de resultado — não copiar código, interface proprietária ou tecnologia fechada de terceiros.

## Princípios técnicos

- **Rust + Tauri:** ciclo de vida do aplicativo, tarefas, cancelamento, logs, configuração e integração segura com o worker.
- **TypeScript + React:** interface e painéis de projeto.
- **Python:** orquestração dos pipelines e integração com ferramentas científicas.
- **COLMAP:** SfM, estimativa de câmeras e base da reconstrução multivista.
- **Integrações modulares:** avaliar ferramentas complementares para reconstrução densa, malhas, texturização, processamento geoespacial e Gaussian Splatting; não presumir que COLMAP sozinho cobre todas as entregas.
- **Aceleração:** começar com uma linha de base CPU. Medir separadamente suporte real do COLMAP, APIs de GPU e Intel Arc; não declarar aceleração por detectar apenas a GPU ou o PyTorch XPU.
- **Linux primeiro:** CI, builds de desenvolvimento e testes Linux. Não adicionar build de Windows sem solicitação.

## Etapas

### Fase 1 — Fundação confiável
- [x] Estrutura inicial Tauri + React/TypeScript + Rust + worker Python.
- [x] Pipeline inicial COLMAP para reconstrução esparsa.
- [x] Testes unitários básicos do worker.
- [ ] CI Linux verde: testes Python, compilação TypeScript, testes Rust.
- [ ] Validação real com um conjunto de fotos documentado.
- [ ] Relatório de diagnóstico do ambiente e logs legíveis.

**Critério de saída:** iniciar a aplicação e concluir uma reconstrução esparsa de teste sem erro; artefatos e logs devem ser verificáveis.

### Fase 2 — Pipeline fotogramétrico completo
- [ ] Gerenciamento de projetos e imagens, miniaturas, metadados e validação de sobreposição.
- [ ] SfM: extração/matching, calibração e registro de câmeras.
- [ ] Reconstrução densa: mapa de profundidade e nuvem de pontos densa.
- [ ] Filtragem, limpeza e exportação de nuvem de pontos.
- [ ] Progresso por etapa baseado em eventos reais; cancelamento e recuperação de falhas.

### Fase 3 — Malha e qualidade visual
- [ ] Geração de malha por integração adequada (avaliar COLMAP, OpenMVS e alternativas).
- [ ] Limpeza, simplificação, fechamento de buracos e normais.
- [ ] Texturização multivista com seleção de imagens/câmeras e tratamento de costuras.
- [ ] Exportação e reimportação de OBJ/MTL, PLY, GLB/glTF e formatos suportados pelos motores escolhidos.
- [ ] Visualizador 3D interativo: orbitar, pan, zoom, enquadrar, alternar pontos/malha/texturas e inspecionar câmeras.

### Fase 4 — Ferramentas de edição e medição
- [ ] Recorte e seleção de regiões, remoção de outliers e edição não destrutiva.
- [ ] Escala e sistema de coordenadas com alvos/pontos de controle.
- [ ] Medidas de distância, área, ângulo e volume, com unidades explícitas.
- [ ] Seções, perfis e linhas de contorno quando suportados pelos dados.

### Fase 5 — Entregas avançadas
- [ ] Ortofotos e modelos de elevação (DSM/DTM), com referência espacial e exportação geográfica.
- [ ] Importação/registro de nuvens externas e avaliação de fluxos LiDAR.
- [ ] Gaussian Splatting com treino, visualização e exportação apropriados.
- [ ] Relatório de reconstrução: imagens registradas, câmeras, resolução, parâmetros, duração, métricas e limitações.
- [ ] Exportação em lote e formatos adicionais priorizados por casos reais de uso.

### Fase 6 — Desempenho e robustez
- [ ] Bancada de desempenho reproduzível: tempo por etapa, RAM, CPU, VRAM/GPU e tamanho dos artefatos.
- [ ] Uso eficiente de memória, processamento em blocos, recuperação e limites configuráveis.
- [ ] Investigar e testar aceleração Intel Arc por caminho suportado, comparando qualidade e tempo com CPU.
- [ ] Testes com datasets pequenos, médios e grandes; validação de falhas e projetos interrompidos.
- [ ] Documentar compatibilidade por sistema, GPU e dependência.
- [ ] Empacotamento e atualizações depois que os pipelines forem confiáveis.

## Como mediremos paridade

A paridade será uma matriz verificável por funcionalidade e não uma afirmação genérica. Cada linha terá: estado (não iniciado / experimental / aprovado), ferramenta usada, formatos aceitos, teste de regressão, dataset de referência, uso de memória e limitações conhecidas. Priorizar primeiro reconstrução confiável, nuvem densa, malha texturizada e visualizador; depois medições, dados geoespaciais e splats.

## Estado atual

O repositório contém apenas o esqueleto inicial e um pipeline esparso. Ainda não é equivalente ao 3DF Zephyr. A CI Linux foi adicionada e precisa terminar com sucesso antes de marcar a fundação como aprovada.
