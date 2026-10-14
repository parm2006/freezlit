import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "server.py"
spec = importlib.util.spec_from_file_location("recall_server", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.web = self.root / "web"
        self.web.mkdir()
        (self.web / "index.html").write_text("<h1>Recall</h1>")
        (self.root / "private.txt").write_text("secret")
        self.folder = self.root / "data"
        self.server = module.FreezlitServer(0, self.folder, self.web)
        self.port = self.server.server_port
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temporary.cleanup()

    def request(self, method="GET", path="/api/library", value=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        request_headers = {"Origin": f"http://127.0.0.1:{self.port}", "Content-Type": "application/json"}
        request_headers.update(headers or {})
        body = json.dumps(value) if value is not None else None
        connection.request(method, path, body, request_headers)
        response = connection.getresponse()
        result = response.status, response.read(), dict(response.getheaders())
        connection.close()
        return result

    def test_initial_empty_library(self):
        status, body, _ = self.request()
        self.assertEqual(status, 200)
        self.assertIsNone(json.loads(body))

    def test_text_images_schedule_persist_and_previous_backup(self):
        first = {"version": 1, "decks": [{"id": "x", "cards": [{"term": "café", "termImage": "data:image/png;base64,abc", "schedule": {"forward": {"due": 42}}}]}]}
        self.assertEqual(self.request("PUT", value=first)[0], 200)
        self.assertEqual(json.loads(self.request()[1]), first)
        second = {"version": 1, "decks": []}
        self.assertEqual(self.request("PUT", value=second)[0], 200)
        self.assertEqual(json.loads((self.folder / "library.previous.json").read_text(encoding="utf-8")), first)
        self.assertEqual(json.loads(self.request()[1]), second)

    def test_invalid_schema_keeps_previous_data(self):
        library = {"decks": []}
        self.request("PUT", value=library)
        self.assertEqual(self.request("PUT", value={"decks": [{"cards": "bad"}]})[0], 400)
        self.assertEqual(json.loads(self.request()[1]), library)

    def test_cross_origin_and_dns_rebinding_rejected(self):
        self.assertEqual(self.request(headers={"Host": "attacker.test"})[0], 403)
        self.assertEqual(self.request("PUT", value={"decks": []}, headers={"Origin": "https://attacker.test"})[0], 403)
        self.assertEqual(self.request("PUT", value={"decks": []}, headers={"Origin": "null"})[0], 403)
        self.assertEqual(self.request(headers={"Sec-Fetch-Site": "cross-site"})[0], 403)

    def test_put_without_origin_rejected(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.port)
        connection.request("PUT", "/api/library", '{"decks":[]}', {"Content-Type": "application/json"})
        response = connection.getresponse()
        self.assertEqual(response.status, 403)
        response.read()
        connection.close()

    def test_oversized_request_and_content_type(self):
        self.assertEqual(self.request("PUT", value={"decks": []}, headers={"Content-Length": str(module.MAX_BYTES + 1)})[0], 413)
        self.assertEqual(self.request("PUT", value={"decks": []}, headers={"Content-Type": "text/plain"})[0], 415)

    def test_static_path_traversal_and_security_headers(self):
        for path in ("/../private.txt", "/%2e%2e/private.txt", "/%2e%2e%5cprivate.txt"):
            self.assertEqual(self.request(path=path)[0], 404)
        status, body, headers = self.request(path="/")
        self.assertEqual(status, 200)
        self.assertIn(b"Recall", body)
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")

    def test_corrupt_library_never_resets(self):
        self.folder.mkdir()
        (self.folder / "library.json").write_text("corrupt")
        self.assertEqual(self.request()[0], 500)
        self.assertEqual((self.folder / "library.json").read_text(), "corrupt")

    def test_nan_not_saved(self):
        self.assertEqual(self.request("PUT", value={"decks": [], "bad": float("nan")})[0], 400)
        self.assertFalse((self.folder / "library.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)

