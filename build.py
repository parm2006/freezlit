"""Create a portable executable on the current OS. Install requirements-build.txt first."""
from pathlib import Path
import argparse
import subprocess
import sys

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Build a portable Freezlit desktop executable.")
parser.add_argument("--output", type=Path, default=root / "dist", help="Executable output directory (default: dist).")
parser.add_argument("--work", "--work-dir", dest="work", type=Path, default=root / "build", help="Build intermediate directory (default: build).")
parser.add_argument("--name", choices=("Freezlit", "FreezlitClone"), default="Freezlit")
parser.add_argument("--updatable", action="store_true", help="Build the directory layout required by Velopack.")
args = parser.parse_args()
output = args.output.resolve()
work = args.work.resolve()
work.mkdir(parents=True, exist_ok=True)
output.mkdir(parents=True, exist_ok=True)
subprocess.run([
    sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir" if args.updatable else "--onefile", "--windowed",
    "--collect-all", "webview", "--collect-all", "pythonnet", "--collect-all", "clr_loader",
    "--name", args.name, "--icon", str(root / "assets" / "freezlit.ico"),
    "--distpath", str(output), "--workpath", str(work),
    "--specpath", str(work), "--add-data", str(root / "web") + ":web",
    "--add-data", str(root / "assets") + ":assets",
    "--add-data", str(root / "scripts" / "updater-shortcuts.ps1") + ":scripts",
    "--add-data", str(root / "third-party-licenses") + ":third-party-licenses",
    "--add-data", str(root / "LICENSE") + ":.",
    "--add-data", str(root / "THIRD_PARTY_NOTICES.md") + ":.",
    "--collect-all", "velopack",
    str(root / "desktop.py"),
], check=True, cwd=root)
