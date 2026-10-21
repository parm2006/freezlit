"""Freezlit's private, local-only storage and web server. Python 3.10+, no dependencies."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
import mimetypes

MAX_BYTES = 100 * 1024 * 1024
STORE_LOCK = threading.Lock()


@contextmanager
def store_lock(folder: Path):
    """Serialize threads and app processes that share the same data directory."""
    folder.mkdir(parents=True, exist_ok=True)
    with STORE_LOCK, (folder / ".library.lock").open("a+b") as lock:
        if os.name == "nt":
            import msvcrt
            lock.seek(0, os.SEEK_END)
            if lock.tell() == 0:
                lock.write(b"\0")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == "nt":
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def revision(data: bytes | None) -> str:
    return '"' + (hashlib.sha256(data).hexdigest() if data is not None else "empty") + '"'


def data_directory() -> Path:
    override = os.environ.get("FREEZLIT_DATA_DIR") or os.environ.get("RECALL_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Freezlit"
    return Path.home() / ".local" / "share" / "freezlit"


def web_directory() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "web"


def validate_library(value):
    if not isinstance(value, dict):
        raise ValueError("Library must be a JSON object.")
    if not isinstance(value.get("decks"), list):
        raise ValueError("Library must contain a decks array.")
    if len(value["decks"]) > 10000:
        raise ValueError("A library can contain at most 10,000 decks.")
    for deck in value["decks"]:
        if not isinstance(deck, dict) or not isinstance(deck.get("cards"), list):
            raise ValueError("Every deck must be an object with a cards array.")
        if any(not isinstance(card, dict) for card in deck["cards"]):
            raise ValueError("Every card must be a JSON object.")
    return value


def read_library(folder: Path):
    path = folder / "library.json"
    if not path.exists():
        return None
    # Do not silently overwrite an unreadable or corrupt library.
    return validate_library(json.loads(path.read_text(encoding="utf-8")))


def read_snapshot(folder: Path):
    path = folder / "library.json"
    if not path.exists():
        return None, revision(None)
    data = path.read_bytes()
    return validate_library(json.loads(data.decode("utf-8"))), revision(data)


def write_library(folder: Path, value, expected_revision=None):
    validate_library(value)
    encoded = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > MAX_BYTES:
        raise ValueError("Library exceeds the 100 MB storage limit.")
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / "library.json"
    current = destination.read_bytes() if destination.exists() else None
    current_revision = revision(current)
    if expected_revision is not None and not hmac.compare_digest(expected_revision, current_revision):
        raise FileExistsError("This library changed in another window. Export your changes before reloading.")
    temporary = None
    backup_temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=folder, prefix="library-", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        if destination.exists():
            with tempfile.NamedTemporaryFile(dir=folder, prefix="backup-", suffix=".tmp", delete=False) as stream:
                backup_temporary = Path(stream.name)
            shutil.copyfile(destination, backup_temporary)
            os.replace(backup_temporary, folder / "library.previous.json")
        os.replace(temporary, destination)
    finally:
        for path in (temporary, backup_temporary):
            if path and path.exists():
                path.unlink()


class FreezlitServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port=8765, folder=None, web=None):
        self.data_folder = Path(folder) if folder else data_directory()
        self.web_folder = (Path(web) if web else web_directory()).resolve()
        super().__init__(("127.0.0.1", port), FreezlitHandler)


class FreezlitHandler(BaseHTTPRequestHandler):
    server_version = "Freezlit/1.0"

    def log_message(self, fmt, *args):
        # URLs and study text are private; log only errors, without request payloads.
        pass

    def respond(self, status, body, content_type="application/json; charset=utf-8", headers=None):
        if isinstance(body, dict) or body is None:
            body = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def error(self, status, message):
        self.respond(status, {"error": message})

    def allowed(self, require_origin=False):
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if self.headers.get("Host") not in hosts:
            self.error(403, "Only the local Freezlit address is allowed.")
            return False
        origin = self.headers.get("Origin")
        if (require_origin and not origin) or (origin and origin not in {"http://" + host for host in hosts}):
            self.error(403, "Requests must come from the local Freezlit app.")
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            self.error(403, "Cross-site requests are not allowed.")
            return False
        return True

    def do_GET(self):
        if not self.allowed():
            return
        route = urlsplit(self.path).path
        if route == "/api/library":
            try:
                with store_lock(self.server.data_folder):
                    value, etag = read_snapshot(self.server.data_folder)
                self.respond(200, value, headers={"ETag": etag})
            except (OSError, ValueError, RecursionError):
                self.error(500, "Library could not be read. Your stored file has been preserved; check library.previous.json for recovery.")
            return
        if route.startswith("/api/"):
            self.error(404, "Unknown API endpoint.")
            return
        try:
            relative = unquote(route, errors="strict").lstrip("/") or "index.html"
            candidate = (self.server.web_folder / relative).resolve()
            if not candidate.is_relative_to(self.server.web_folder) or not candidate.is_file():
                self.error(404, "File not found.")
                return
            self.respond(200, candidate.read_bytes(), mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        except (ValueError, OSError, UnicodeError):
            self.error(404, "File not found.")

    def do_HEAD(self):
        self.do_GET()

    def do_PUT(self):
        if not self.allowed(require_origin=True):
            return
        if urlsplit(self.path).path != "/api/library":
            self.error(404, "Unknown API endpoint.")
            return
        expected_revision = self.headers.get("If-Match")
        if expected_revision is None:
            self.error(428, "A current library revision is required. Reload before saving.")
            return
        if expected_revision != '"empty"' and not (expected_revision.startswith('"') and expected_revision.endswith('"') and len(expected_revision) == 66 and all(c in "0123456789abcdef" for c in expected_revision[1:-1])):
            self.error(400, "Invalid library revision.")
            return
        if self.headers.get_content_type() != "application/json":
            self.error(415, "Expected application/json.")
            return
        lengths = self.headers.get_all("Content-Length", [])
        if self.headers.get("Transfer-Encoding") or len(lengths) != 1:
            self.error(400, "A single Content-Length is required.")
            return
        try:
            length = int(lengths[0])
        except ValueError:
            self.error(400, "Invalid Content-Length.")
            return
        if length < 0 or length > MAX_BYTES:
            self.error(413, "Library exceeds the 100 MB limit.")
            return
        try:
            self.connection.settimeout(30)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("Incomplete request body.")
            value = json.loads(raw.decode("utf-8"), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Invalid JSON number.")))
            with store_lock(self.server.data_folder):
                write_library(self.server.data_folder, value, expected_revision)
                etag = revision((self.server.data_folder / "library.json").read_bytes())
            self.respond(200, {"ok": True}, headers={"ETag": etag})
        except FileExistsError as exc:
            self.error(409, str(exc))
        except (ValueError, UnicodeError, RecursionError) as exc:
            self.error(400, str(exc) if isinstance(exc, ValueError) else "Invalid JSON library.")
        except (OSError, TimeoutError):
            self.error(500, "Library could not be saved. Your previous file has been preserved.")


def main():
    parser = argparse.ArgumentParser(description="Run Freezlit locally; all study data stays on this computer.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true", help="Run only the local server, for testing.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    try:
        server = FreezlitServer(args.port)
    except OSError as exc:
        message = f"Freezlit could not start on port {args.port}: {exc}\nIf Freezlit is already running, open its existing window. Otherwise run with --port 8766."
        if sys.platform == "win32" and not args.no_browser:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, "Freezlit", 0x10)
        else:
            print(message, file=sys.stderr)
        return 1
    url = f"http://127.0.0.1:{server.server_port}"
    if not args.no_browser:
        try:
            import webview
        except ImportError:
            print("Install desktop dependencies: python -m pip install pywebview", file=sys.stderr)
            server.server_close()
            return 1
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            # pywebview defaults to blocking Blob downloads. Its Windows handler
            # prompts with a native SaveFileDialog before writing exported JSON.
            webview.settings["ALLOW_DOWNLOADS"] = True
            webview.create_window("Freezlit", url, width=1180, height=800, min_size=(760, 600), background_color="#F6F5F1")
            icon_path = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "assets" / "freezlit.ico"
            webview.start(gui="edgechromium" if sys.platform == "win32" else None, private_mode=True,
                          icon=str(icon_path) if icon_path.is_file() else None)
        except Exception as exc:
            # Windowed Windows builds have no console: make launch failures visible.
            message = f"Freezlit could not open its desktop window. Ensure Microsoft Edge WebView2 Runtime is installed.\n\n{exc}"
            if sys.platform == "win32":
                import ctypes
                ctypes.windll.user32.MessageBoxW(None, message, "Freezlit", 0x10)
            else:
                print(message, file=sys.stderr)
            return 1
        finally:
            server.shutdown()
            server.server_close()
        return 0
    print(f"Freezlit: {url}\nYour library: {server.data_folder}\nPress Ctrl+C to stop Freezlit.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
