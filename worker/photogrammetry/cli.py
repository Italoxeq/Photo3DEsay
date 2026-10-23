#!/usr/bin/env python3
"""CLI worker for PhotoForge's initial COLMAP sparse reconstruction pipeline."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}


def emit(event_type: str, stage: str, message: str, progress: int = 0) -> None:
    """Write one JSON event per line for the Rust process to forward to the UI."""
    payload = {
        "type": event_type,
        "stage": stage,
        "message": message,
        "progress": max(0, min(100, int(progress))),
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def find_images(images_dir: Path) -> list[Path]:
    """Find supported image files recursively, sorted for repeatable validation."""
    if not images_dir.is_dir():
        raise ValueError(f"A pasta de imagens não existe: {images_dir}")
    return sorted(
        path for path in images_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def build_commands(images_dir: Path, workspace_dir: Path, colmap_executable: str = "colmap") -> list[tuple[str, list[str], int]]:
    """Build the conservative CPU-only command sequence for sparse SfM."""
    database = workspace_dir / "database.db"
    sparse_dir = workspace_dir / "sparse"
    return [
        (
            "Extração de características",
            [colmap_executable, "feature_extractor", "--database_path", str(database),
             "--image_path", str(images_dir), "--FeatureExtraction.use_gpu", "0"],
            15,
        ),
        (
            "Correspondência de imagens",
            [colmap_executable, "exhaustive_matcher", "--database_path", str(database),
             "--FeatureMatching.use_gpu", "0"],
            50,
        ),
        (
            "Reconstrução esparsa",
            [colmap_executable, "mapper", "--database_path", str(database),
             "--image_path", str(images_dir), "--output_path", str(sparse_dir)],
            75,
        ),
    ]


def run_stage(command: Sequence[str], stage: str, progress: int) -> None:
    emit("status", stage, f"Executando: {' '.join(command[:2])}", progress)
    try:
        completed = subprocess.Popen(
            list(command), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
    except OSError as exc:
        raise RuntimeError(f"Não foi possível executar o COLMAP: {exc}") from exc

    assert completed.stdout is not None
    for raw_line in completed.stdout:
        line = raw_line.strip()
        if line:
            # Prevent a single unusually long diagnostic line from overwhelming the UI.
            emit("log", stage, line[:1200], progress)
    return_code = completed.wait()
    if return_code != 0:
        raise RuntimeError(f"A etapa '{stage}' falhou com código {return_code}.")
    emit("status", stage, f"Etapa concluída: {stage}", min(progress + 10, 95))


def reconstruct(images_dir: Path, workspace_dir: Path, colmap_executable: str = "colmap") -> int:
    images = find_images(images_dir)
    if len(images) < 2:
        raise ValueError(f"Foram encontradas {len(images)} imagens; são necessárias pelo menos duas.")
    if shutil.which(colmap_executable) is None:
        raise RuntimeError(f"COLMAP não foi encontrado no PATH: {colmap_executable}")

    workspace_dir.mkdir(parents=True, exist_ok=True)
    (workspace_dir / "sparse").mkdir(parents=True, exist_ok=True)
    emit("status", "Preparando projeto", f"Encontradas {len(images)} imagens suportadas.", 5)
    emit("status", "Preparando projeto", "Modo CPU selecionado para garantir compatibilidade inicial.", 8)

    for stage, command, progress in build_commands(images_dir, workspace_dir, colmap_executable):
        run_stage(command, stage, progress)

    model_dirs = [path for path in (workspace_dir / "sparse").iterdir() if path.is_dir()]
    if not model_dirs:
        raise RuntimeError("O COLMAP terminou sem gerar um modelo esparso. Confira as correspondências e a sobreposição das fotos.")
    emit("finished", "Reconstrução esparsa concluída", f"Reconstrução esparsa criada em {workspace_dir / 'sparse'}.", 100)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Worker local de fotogrametria do PhotoForge")
    subparsers = parser.add_subparsers(dest="command", required=True)
    reconstruct_parser = subparsers.add_parser("reconstruct", help="executa SfM esparso com COLMAP")
    reconstruct_parser.add_argument("--images", type=Path, required=True, help="pasta de entrada de imagens")
    reconstruct_parser.add_argument("--workspace", type=Path, required=True, help="pasta de saída do projeto")
    reconstruct_parser.add_argument("--use-gpu", choices=("cpu",), default="cpu", help="a primeira fase suporta modo CPU")
    reconstruct_parser.add_argument("--colmap", default="colmap", help="nome/caminho do executável COLMAP")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "reconstruct":
            return reconstruct(args.images.expanduser().resolve(), args.workspace.expanduser().resolve(), args.colmap)
    except (ValueError, RuntimeError, OSError) as exc:
        emit("error", "Falha na reconstrução", str(exc), 0)
        return 1
    parser.error("Comando não suportado")
    return 2


if __name__ == "__main__":
    sys.exit(main())
