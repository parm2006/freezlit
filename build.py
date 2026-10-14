"""Create a portable executable on the current OS. Install requirements-build.txt first."""
from pathlib import Path
import argparse
import subprocess
import sys

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Build a portable Freezlit desktop executable.")
parser.add_argument("--output", type=Path, default=root / "dist", help="Executable output directory (default: dist).")
parser.add_argument("--work", "--work-dir", dest="work", type=Path, default=root / "build", help="Build intermediate directory (default: build).")
args = parser.parse_args()
output = args.output.resolve()
work = args.work.resolve()
work.mkdir(parents=True, exist_ok=True)
output.mkdir(parents=True, exist_ok=True)
subprocess.run([
    sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--windowed",
    "--collect-all", "webview", "--collect-all", "pythonnet", "--collect-all", "clr_loader",
    "--name", "Freezlit", "--distpath", str(output), "--workpath", str(work),
    "--specpath", str(work), "--add-data", str(root / "web") + ":web",
    str(root / "server.py"),
], check=True, cwd=root)
