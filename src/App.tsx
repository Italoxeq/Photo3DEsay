import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type EnvironmentStatus = {
  python_available: boolean;
  python_version: string | null;
  colmap_available: boolean;
  colmap_version: string | null;
  intel_arc_detected: boolean;
  intel_arc_details: string | null;
  torch_xpu_available: boolean;
  notes: string[];
};

type WorkerEvent = {
  type?: string;
  stage?: string;
  message?: string;
  progress?: number;
};

const defaultWorkspace = '~/Photo3DEsayProjects/PrimeiroProjeto';

function parseWorkerEvent(raw: string): WorkerEvent {
  try {
    return JSON.parse(raw) as WorkerEvent;
  } catch {
    return { type: 'log', message: raw };
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`status-dot ${ok ? 'is-ok' : 'is-off'}`} aria-hidden="true" />;
}

export default function App() {
  const [imagesDir, setImagesDir] = useState('');
  const [workspaceDir, setWorkspaceDir] = useState(defaultWorkspace);
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Pronto para começar');
  const [logs, setLogs] = useState<string[]>([
    'Photo3DEsay inicializado. Verifique o ambiente antes da primeira reconstrução.',
  ]);
  const [error, setError] = useState<string | null>(null);

  const imagePathValid = useMemo(() => imagesDir.trim().length > 0, [imagesDir]);
  const workspacePathValid = useMemo(() => workspaceDir.trim().length > 0, [workspaceDir]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let disposed = false;
    listen<string>('reconstruction-event', (event) => {
      const payload = parseWorkerEvent(event.payload);
      const message = payload.message ?? 'Atualização do processamento.';
      setLogs((current) => [...current.slice(-199), message]);
      if (payload.stage) setStage(payload.stage);
      if (typeof payload.progress === 'number') setProgress(Math.max(0, Math.min(100, payload.progress)));
      if (payload.type === 'finished') {
        setRunning(false);
        setProgress(100);
        setStage('Reconstrução esparsa concluída');
      } else if (payload.type === 'error') {
        setRunning(false);
        setError(message);
        setStage('Falha na reconstrução');
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    }).catch((reason: unknown) => {
      setLogs((current) => [...current, `Não foi possível registrar eventos: ${String(reason)}`]);
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  async function checkEnvironment() {
    setChecking(true);
    setError(null);
    try {
      const result = await invoke<EnvironmentStatus>('get_environment_status');
      setEnvironment(result);
      setLogs((current) => [...current, 'Verificação do ambiente concluída.']);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setChecking(false);
    }
  }

  async function startReconstruction() {
    setError(null);
    setProgress(0);
    setRunning(true);
    setStage('Preparando projeto');
    setLogs((current) => [...current, 'Solicitando início da reconstrução esparsa...']);
    try {
      const id = await invoke<string>('start_reconstruction', {
        imagesDir: imagesDir.trim(),
        workspaceDir: workspaceDir.trim(),
      });
      setJobId(id);
      setLogs((current) => [...current, `Tarefa iniciada: ${id}`]);
    } catch (reason) {
      setRunning(false);
      setError(String(reason));
      setStage('Não foi possível iniciar');
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><div className="brand-name">Photo3DEsay</div><div className="brand-subtitle">RECONSTRUCTION STUDIO</div></div>
        </div>
        <div className="sidebar-section-label">ESPAÇO DE TRABALHO</div>
        <button className="nav-item active" type="button"><span className="nav-icon">▦</span>Reconstrução</button>
        <button className="nav-item" type="button" disabled title="Disponível em uma próxima fase"><span className="nav-icon">◈</span>Modelos 3D <span className="soon-tag">EM BREVE</span></button>
        <button className="nav-item" type="button" disabled title="Disponível em uma próxima fase"><span className="nav-icon">⚙</span>Preferências</button>
        <div className="sidebar-bottom">
          <div className="engine-card">
            <div className="engine-card-top"><span className="engine-badge">SfM</span><span className="engine-online" /></div>
            <div className="engine-title">Motor de reconstrução</div>
            <div className="engine-name">COLMAP CLI</div>
            <div className="engine-caption">Structure from Motion</div>
          </div>
          <div className="version-row"><span>Photo3DEsay Alpha</span><span>v0.1.0</span></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Projetos</span><span className="breadcrumb-divider">/</span><strong>Novo projeto</strong></div>
          <div className="topbar-right"><span className="local-badge"><span className="local-dot" />PROCESSAMENTO LOCAL</span><div className="avatar">PF</div></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">WORKSPACE / FOTOGRAMETRIA</div><h1>Nova reconstrução</h1><p>Transforme uma sequência de fotografias em uma cena 3D reconstruída.</p></div>
            <div className="step-chip"><span className="step-chip-number">01</span><span>RECONSTRUÇÃO ESPARSA</span></div>
          </div>

          <div className="workflow-strip" aria-label="Etapas do pipeline">
            <div className="workflow-step selected"><span className="workflow-number">01</span><span>Fotografias</span></div><span className="workflow-line" />
            <div className="workflow-step"><span className="workflow-number">02</span><span>Correspondências</span></div><span className="workflow-line" />
            <div className="workflow-step"><span className="workflow-number">03</span><span>Câmeras e pontos</span></div><span className="workflow-line" />
            <div className="workflow-step muted"><span className="workflow-number">04</span><span>Malha e textura</span></div>
          </div>

          <div className="workspace-grid">
            <section className="panel project-panel">
              <div className="panel-heading"><div><div className="section-kicker">CONFIGURAÇÃO DO PROJETO</div><h2>Conjunto de fotografias</h2></div><span className="panel-step">01 / 03</span></div>
              <p className="panel-description">Selecione a pasta que contém as imagens da mesma cena. Use caminhos absolutos do Linux.</p>
              <label className="field-label" htmlFor="images-dir">PASTA DAS IMAGENS</label>
              <div className="path-field"><span className="field-prefix">▤</span><input id="images-dir" value={imagesDir} onChange={(event) => setImagesDir(event.target.value)} placeholder="/home/usuario/Fotos/Objeto" spellCheck={false} /><span className="field-type">DIRETÓRIO</span></div>
              <div className="field-hint">Formatos esperados: JPG, JPEG, PNG, TIFF e BMP. Use pelo menos duas fotografias.</div>
              <div className="field-separator" />
              <label className="field-label" htmlFor="workspace-dir">PASTA DE SAÍDA DO PROJETO</label>
              <div className="path-field"><span className="field-prefix">▱</span><input id="workspace-dir" value={workspaceDir} onChange={(event) => setWorkspaceDir(event.target.value)} placeholder="/home/usuario/Photo3DEsayProjects/MeuProjeto" spellCheck={false} /><span className="field-type">SAÍDA</span></div>
              <div className="field-hint">O banco de dados e o modelo esparso serão gravados nessa pasta.</div>
              <div className="notice"><span className="notice-icon">i</span><div><strong>Reconstrução local</strong><p>As fotografias são processadas no seu computador. Não há envio para servidores externos.</p></div></div>
              <div className="panel-footer"><div className="footer-note"><span className="tiny-lock">▣</span>CPU como modo de compatibilidade inicial</div><button className="primary-button" onClick={startReconstruction} disabled={running || !imagePathValid || !workspacePathValid || !environment?.colmap_available} type="button"><span>{running ? 'Reconstruindo...' : 'Iniciar reconstrução'}</span><span className="button-arrow">↗</span></button></div>
              {!environment?.colmap_available && <div className="disabled-hint">Verifique o ambiente e instale o COLMAP antes de iniciar.</div>}
            </section>

            <div className="right-column">
              <section className="panel diagnostics-panel">
                <div className="panel-heading"><div><div className="section-kicker">DIAGNÓSTICO</div><h2>Ambiente de processamento</h2></div><button className="refresh-button" type="button" onClick={checkEnvironment} disabled={checking} aria-label="Verificar ambiente">↻</button></div>
                <p className="panel-description">Verifique as ferramentas locais antes de executar o pipeline.</p>
                <div className="diagnostic-list">
                  <div className="diagnostic-row"><div className="diagnostic-symbol">Py</div><div className="diagnostic-copy"><strong>Python 3</strong><span>{environment?.python_version ?? 'Aguardando verificação'}</span></div><StatusDot ok={!!environment?.python_available} /></div>
                  <div className="diagnostic-row"><div className="diagnostic-symbol colmap-symbol">C</div><div className="diagnostic-copy"><strong>COLMAP</strong><span>{environment?.colmap_version ?? 'Aguardando verificação'}</span></div><StatusDot ok={!!environment?.colmap_available} /></div>
                  <div className="diagnostic-row"><div className="diagnostic-symbol gpu-symbol">▰</div><div className="diagnostic-copy"><strong>Intel Arc</strong><span>{environment ? (environment.intel_arc_detected ? (environment.intel_arc_details ?? 'Dispositivo detectado') : 'Não detectada pelo diagnóstico') : 'Aguardando verificação'}</span></div><StatusDot ok={!!environment?.intel_arc_detected} /></div>
                  <div className="diagnostic-row"><div className="diagnostic-symbol xpu-symbol">X</div><div className="diagnostic-copy"><strong>PyTorch XPU</strong><span>{environment ? (environment.torch_xpu_available ? 'Disponível no Python' : 'Não disponível neste ambiente') : 'Aguardando verificação'}</span></div><StatusDot ok={!!environment?.torch_xpu_available} /></div>
                </div>
                <button className="secondary-button full-width" type="button" onClick={checkEnvironment} disabled={checking}>{checking ? <><span className="spinner" />Verificando...</> : 'Verificar ambiente'}</button>
                {environment && <div className="diagnostic-note">A presença da Intel Arc não significa que o COLMAP consiga utilizá-la. A aceleração será considerada somente após teste específico.</div>}
              </section>

              <section className="panel pipeline-panel">
                <div className="panel-heading"><div><div className="section-kicker">PIPELINE ATUAL</div><h2>Structure from Motion</h2></div><span className="pipeline-state">{running ? 'EM EXECUÇÃO' : 'AGUARDANDO'}</span></div>
                <div className="pipeline-mini-list"><div className={`mini-stage ${running ? 'current' : ''}`}><span className="mini-stage-icon">01</span><div><strong>Extração de características</strong><span>SIFT · pontos-chave por imagem</span></div></div><div className={`mini-stage ${stage.toLowerCase().includes('correspond') ? 'current' : ''}`}><span className="mini-stage-icon">02</span><div><strong>Correspondência de imagens</strong><span>Comparação de pares de fotografias</span></div></div><div className={`mini-stage ${stage.toLowerCase().includes('map') || stage.toLowerCase().includes('espars') ? 'current' : ''}`}><span className="mini-stage-icon">03</span><div><strong>Reconstrução esparsa</strong><span>Poses de câmera e nuvem de pontos</span></div></div></div>
                <div className="progress-block"><div className="progress-label"><span>{stage}</span><strong>{progress}%</strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div></div>
              </section>
            </div>
          </div>

          <section className="panel logs-panel"><div className="logs-heading"><div><div className="section-kicker">SAÍDA DO PROCESSO</div><h2>Registro de execução</h2></div><span className="log-count">{logs.length} mensagens</span></div><div className="log-console" role="log" aria-live="polite">{logs.slice(-8).map((line, index) => <div className="log-line" key={`${index}-${line}`}><span className="log-prompt">›</span><span>{line}</span></div>)}</div></section>
          {error && <div className="error-banner" role="alert"><strong>Ocorreu um erro</strong><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Fechar erro">×</button></div>}
          <footer className="page-footer"><span>Photo3DEsay · Ferramenta local de fotogrametria</span><span>{jobId ? `Tarefa ${jobId}` : 'Nenhuma tarefa ativa'}</span></footer>
        </div>
      </section>
    </main>
  );
}
