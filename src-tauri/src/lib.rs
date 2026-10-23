use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::io::{BufRead, BufReader};
use tauri::{Emitter, Manager};

static NEXT_JOB_ID: AtomicU64 = AtomicU64::new(1);
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "tif", "tiff", "bmp", "webp"];

#[derive(Debug, Serialize)]
struct EnvironmentStatus {
    python_available: bool,
    python_version: Option<String>,
    colmap_available: bool,
    colmap_version: Option<String>,
    intel_arc_detected: bool,
    intel_arc_details: Option<String>,
    torch_xpu_available: bool,
    notes: Vec<String>,
}

#[derive(Debug, Serialize)]
struct ImageInspection {
    image_count: usize,
    extensions: Vec<String>,
}

fn configured_python() -> String {
    std::env::var("PHOTO3DESAY_PYTHON").unwrap_or_else(|_| "python3".to_string())
}

fn command_output(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    let combined = if output.stdout.is_empty() { output.stderr } else { output.stdout };
    Some(String::from_utf8_lossy(&combined).trim().to_string())
}

fn find_intel_arc() -> Option<String> {
    let output = command_output("lspci", &[])?;
    output.lines().find(|line| {
        let lower = line.to_ascii_lowercase();
        lower.contains("intel") && lower.contains("arc")
    }).map(|line| line.trim().to_string())
}

#[tauri::command]
fn get_environment_status() -> EnvironmentStatus {
    let python = configured_python();
    let python_version = command_output(&python, &["--version"]);
    let python_available = python_version.is_some();

    let colmap_version = command_output("colmap", &["-h"])
        .or_else(|| command_output("colmap", &["--help"]));
    let colmap_available = colmap_version.is_some();
    let colmap_version = colmap_version.map(|output| {
        output.lines().take(2).collect::<Vec<_>>().join(" ")
    });

    let intel_arc_details = find_intel_arc();
    let intel_arc_detected = intel_arc_details.is_some();
    let torch_xpu_available = python_available && command_output(
        &python,
        &["-c", "import torch; print('yes' if hasattr(torch, 'xpu') and torch.xpu.is_available() else 'no')"],
    ).map(|value| value.trim().ends_with("yes")).unwrap_or(false);

    let mut notes = Vec::new();
    if !python_available { notes.push(format!("Python não foi encontrado usando o comando '{python}'.")); }
    if !colmap_available { notes.push("COLMAP não foi encontrado no PATH.".to_string()); }
    if intel_arc_detected {
        notes.push("A GPU Intel foi identificada pelo lspci. Isso, isoladamente, não habilita aceleração no COLMAP.".to_string());
    } else {
        notes.push("Não foi possível confirmar uma Intel Arc pelo lspci; instale pciutils ou confira o driver.".to_string());
    }
    if !torch_xpu_available {
        notes.push("PyTorch XPU não está disponível (ou PyTorch não está instalado). O pipeline inicial usa CPU.".to_string());
    }

    EnvironmentStatus {
        python_available,
        python_version,
        colmap_available,
        colmap_version,
        intel_arc_detected,
        intel_arc_details,
        torch_xpu_available,
        notes,
    }
}

#[tauri::command]
fn inspect_images(images_dir: String) -> Result<ImageInspection, String> {
    let root = expand_user_path(images_dir.trim());
    if !root.is_dir() {
        return Err(format!("A pasta de imagens não existe: {}", root.display()));
    }
    let (image_count, extensions) = collect_images(&root)?;
    if image_count < 2 {
        return Err(format!("Foram encontradas {image_count} imagens. A fotogrametria exige pelo menos duas."));
    }
    Ok(ImageInspection { image_count, extensions })
}

fn expand_user_path(raw: &str) -> PathBuf {
    if raw == "~" {
        return std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(raw));
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(raw)
}

fn collect_images(root: &Path) -> Result<(usize, Vec<String>), String> {
    let mut count = 0usize;
    let mut extensions = std::collections::BTreeSet::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir).map_err(|e| format!("Não foi possível ler {}: {e}", dir.display()))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Falha ao ler entrada de diretório: {e}"))?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() {
                let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
                if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
                    count += 1;
                    extensions.insert(extension);
                }
            }
        }
    }
    Ok((count, extensions.into_iter().collect()))
}

#[tauri::command]
fn start_reconstruction(
    app: tauri::AppHandle,
    images_dir: String,
    workspace_dir: String,
) -> Result<String, String> {
    let images = expand_user_path(images_dir.trim());
    let workspace = expand_user_path(workspace_dir.trim());
    if !images.is_dir() {
        return Err(format!("A pasta de imagens não existe: {}", images.display()));
    }
    if workspace.as_os_str().is_empty() {
        return Err("Informe uma pasta de saída válida.".to_string());
    }
    let (count, _) = collect_images(&images)?;
    if count < 2 {
        return Err(format!("Foram encontradas {count} imagens; são necessárias pelo menos duas."));
    }
    if images == workspace || images.starts_with(&workspace) {
        return Err("A pasta de saída não deve ser a própria pasta de imagens nem estar dentro dela.".to_string());
    }
    fs::create_dir_all(&workspace).map_err(|e| format!("Não foi possível criar a pasta de saída: {e}"))?;

    let job_id = format!("job-{}", NEXT_JOB_ID.fetch_add(1, Ordering::Relaxed));
    let app_handle = app.clone();
    let worker_path = worker_script_path(&app)?;
    let python = configured_python();
    std::thread::Builder::new()
        .name(format!("photo3desay-{job_id}"))
        .spawn(move || {
            run_worker(app_handle, &python, &worker_path, &images, &workspace, &job_id);
        })
        .map_err(|e| format!("Não foi possível iniciar a tarefa: {e}"))?;
    Ok(job_id)
}

fn worker_script_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent()
            .ok_or_else(|| "Não foi possível localizar a raiz do projeto.".to_string())?;
        return Ok(root.join("worker").join("photogrammetry").join("cli.py"));
    }
    let resource_dir = app.path().resource_dir().map_err(|e| format!("Não foi possível localizar recursos do aplicativo: {e}"))?;
    let candidate = resource_dir.join("worker").join("photogrammetry").join("cli.py");
    if candidate.is_file() { return Ok(candidate); }
    Err("Worker Python não encontrado. A configuração de empacotamento será adicionada em uma fase posterior.".to_string())
}

fn emit_worker_event(app: &tauri::AppHandle, raw: &str) {
    let _ = app.emit("reconstruction-event", raw.to_string());
}

fn emit_local_event(app: &tauri::AppHandle, event_type: &str, stage: &str, message: &str, progress: u8) {
    let json = serde_json::json!({
        "type": event_type,
        "stage": stage,
        "message": message,
        "progress": progress
    });
    emit_worker_event(app, &json.to_string());
}

fn run_worker(app: tauri::AppHandle, python: &str, script: &Path, images: &Path, workspace: &Path, job_id: &str) {
    emit_local_event(&app, "status", "Preparando projeto", "Iniciando worker Python em modo CPU compatível.", 0);
    if !script.is_file() {
        emit_local_event(&app, "error", "Falha", &format!("Worker não encontrado: {}", script.display()), 0);
        return;
    }
    let child = Command::new(python)
        .arg(script)
        .arg("reconstruct")
        .arg("--images").arg(images)
        .arg("--workspace").arg(workspace)
        .arg("--use-gpu").arg("cpu")
        .stdout(Stdio::piped())
        .stderr(Stdio::stdout())
        .spawn();
    let mut child = match child {
        Ok(child) => child,
        Err(error) => {
            emit_local_event(&app, "error", "Falha", &format!("Não foi possível iniciar Python ({python}): {error}"), 0);
            return;
        }
    };
    if let Some(stdout) = child.stdout.take() {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(line) => emit_worker_event(&app, &line),
                Err(error) => emit_local_event(&app, "log", "Processamento", &format!("Erro ao ler saída do worker: {error}"), 0),
            }
        }
    }
    match child.wait() {
        Ok(status) if status.success() => emit_local_event(&app, "finished", "Reconstrução esparsa concluída", &format!("Tarefa {job_id} terminou com sucesso."), 100),
        Ok(status) => emit_local_event(&app, "error", "Falha na reconstrução", &format!("O worker terminou com código {status}. Consulte o registro acima."), 0),
        Err(error) => emit_local_event(&app, "error", "Falha", &format!("Não foi possível aguardar o worker: {error}"), 0),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_environment_status, inspect_images, start_reconstruction])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar Photo3DEsay");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;

    fn temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("photo3desay-test-{}-{label}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("criar diretório temporário");
        path
    }

    #[test]
    fn counts_supported_images_recursively_and_case_insensitively() {
        let root = temp_dir("images");
        fs::create_dir_all(root.join("nested")).unwrap();
        File::create(root.join("one.JPG")).unwrap();
        File::create(root.join("nested").join("two.png")).unwrap();
        File::create(root.join("ignore.txt")).unwrap();
        let (count, extensions) = collect_images(&root).unwrap();
        assert_eq!(count, 2);
        assert_eq!(extensions, vec!["jpg".to_string(), "png".to_string()]);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn ignores_unsupported_extensions() {
        let root = temp_dir("unsupported");
        File::create(root.join("readme.txt")).unwrap();
        let (count, extensions) = collect_images(&root).unwrap();
        assert_eq!(count, 0);
        assert!(extensions.is_empty());
        let _ = fs::remove_dir_all(root);
    }
}
