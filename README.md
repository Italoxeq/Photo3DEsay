# Photo3DEsay

Aplicativo desktop independente para fotogrametria local, com Tauri 2, React/TypeScript, Rust e um worker Python que coordena o COLMAP.

> **Estado:** scaffold inicial. A primeira versão executa reconstrução esparsa (SfM) em modo CPU. Não implementa ainda reconstrução densa, malha texturizada, visualizador de malha, cancelamento de tarefa ou empacotamento de recursos no instalador.

## Arquitetura

- `src/`: interface React/TypeScript.
- `src-tauri/`: janela desktop, comandos Rust, diagnóstico e ponte para o worker.
- `worker/photogrammetry/cli.py`: validação e pipeline COLMAP.
- `worker/tests/`: testes unitários do worker Python.
- `.github/workflows/linux-ci.yml`: verificações Linux; não existe job de Windows.

## Requisitos no Linux (Ubuntu/Debian)

Ferramentas básicas:

```bash
sudo apt update
sudo apt install -y build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev pkg-config python3 python3-venv python3-pip nodejs npm pciutils
```

Instale também Rust pelo instalador oficial (`rustup`) e o COLMAP com um pacote compatível com sua distribuição ou com as instruções oficiais do projeto. Confirme:

```bash
rustc --version
cargo --version
node --version
npm --version
python3 --version
colmap -h
```

O script aceita outro nome/caminho do Python com `PHOTO3DESAY_PYTHON`, por exemplo `PHOTO3DESAY_PYTHON=/usr/bin/python3`.

## Executar em modo desenvolvimento

Na raiz do projeto:

```bash
npm install
npm run tauri dev
```

O worker nesta fase usa apenas bibliotecas padrão do Python. Não é necessário instalar PyTorch para a reconstrução pelo COLMAP.

## Testes Linux

```bash
PYTHONPATH=worker python3 -m unittest discover -s worker/tests -v
npm run build
cd src-tauri && cargo test
```

Ou execute `./scripts/test-linux.sh` depois de instalar dependências e gerar `package-lock.json`/`Cargo.lock` com o gerenciador de pacotes local.

## Primeiro teste de reconstrução

1. Separe uma pasta com pelo menos duas fotos da mesma cena, com boa sobreposição entre imagens.
2. Inicie Photo3DEsay e clique em **Verificar ambiente**.
3. Informe os caminhos absolutos da pasta de fotos e da pasta de saída.
4. Clique em **Iniciar reconstrução**.
5. O banco de dados será gravado em `database.db` e o modelo esparso em `sparse/` dentro da pasta de saída.

O pipeline chama `feature_extractor`, `exhaustive_matcher` e `mapper` com as opções de GPU desativadas. Isso é intencional para ter uma linha de base reproduzível. A detecção de uma Intel Arc e a disponibilidade do PyTorch XPU são diagnósticos distintos: eles não demonstram que o COLMAP está usando a GPU. A aceleração será investigada em uma fase separada.

## Limitações desta fase

- Sem botão de seleção de pasta nativo; insira os caminhos Linux manualmente.
- Não há cancelamento de processamento ainda.
- A barra de progresso reflete as etapas, não o percentual interno real do COLMAP.
- O modo de desenvolvimento é o alvo desta entrega. `bundle.active` está desligado enquanto recursos Python e dependências são organizados para empacotamento posterior.
- O worker procura o COLMAP no `PATH`.

## Próxima fase sugerida

Adicionar seletor de diretórios nativo, cancelamento seguro, descoberta confiável de saídas COLMAP e visualizador 3D para o modelo esparso, antes de trabalhar na reconstrução densa e texturização.
