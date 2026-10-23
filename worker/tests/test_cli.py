from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from photogrammetry.cli import build_commands, find_images


class FindImagesTests(unittest.TestCase):
    def test_finds_supported_images_recursively_and_case_insensitively(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "nested").mkdir()
            (root / "one.JPG").touch()
            (root / "nested" / "two.png").touch()
            (root / "notes.txt").touch()
            found = find_images(root)
            self.assertEqual(sorted(path.name for path in found), ["one.JPG", "two.png"])

    def test_missing_directory_raises(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            missing = Path(temporary) / "not-created"
            with self.assertRaisesRegex(ValueError, "não existe"):
                find_images(missing)

    def test_builds_cpu_fallback_commands_in_pipeline_order(self) -> None:
        images = Path("/photos")
        workspace = Path("/project")
        commands = build_commands(images, workspace)
        self.assertEqual([item[0] for item in commands], [
            "Extração de características",
            "Correspondência de imagens",
            "Reconstrução esparsa",
        ])
        self.assertIn("--FeatureExtraction.use_gpu", commands[0][1])
        self.assertIn("0", commands[0][1])
        self.assertIn("--FeatureMatching.use_gpu", commands[1][1])
        self.assertEqual(commands[2][1][-1], str(workspace / "sparse"))


if __name__ == "__main__":
    unittest.main()
