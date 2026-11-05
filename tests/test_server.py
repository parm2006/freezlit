import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "server.py"
spec = importlib.util.spec_from_file_location("recall_server", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SpellingMenuTests(unittest.TestCase):
    def test_spelling_bridge_calls_the_native_dictionary(self):
        api=module.CloseAPI(None)
        with patch('spelling.suggestions',return_value={'available':True,'suggestions':['sentence']}) as lookup:
            self.assertEqual(api.spelling_suggestions('sentnce')['suggestions'],['sentence'])
            lookup.assert_called_once_with('sentnce')

    def test_enables_native_menu_on_ui_thread(self):
        settings = SimpleNamespace(AreDefaultContextMenusEnabled=False, AreDevToolsEnabled=False)
        invoked = []

        def invoke(callback):
            invoked.append(callback)
            callback()

        window = SimpleNamespace(native=SimpleNamespace(
            webview=SimpleNamespace(CoreWebView2=SimpleNamespace(Settings=settings)), Invoke=invoke))
        with patch.dict("sys.modules", {"System": SimpleNamespace(Action=lambda callback: callback)}):
            module.enable_spelling_menu(window)
        self.assertEqual(len(invoked), 1)
        self.assertTrue(settings.AreDefaultContextMenusEnabled)
        self.assertFalse(settings.AreDevToolsEnabled)


class CloseGuardTests(unittest.TestCase):
    def test_close_waits_for_successful_flush_and_failure_keeps_window_open(self):
        guard = module.CloseGuard()
        calls = []
        window = SimpleNamespace(run_js=lambda script:calls.append(script), destroy=lambda:calls.append('destroy'), create_confirmation_dialog=lambda title,message:False)
        with patch.object(module.threading, 'Thread') as worker:
            worker.side_effect=lambda target,daemon:SimpleNamespace(start=target)
            self.assertFalse(guard.closing(window))
            self.assertFalse(guard.closing(window))
        self.assertEqual(len(calls),1)
        guard.finish_close(False)
        self.assertNotIn('destroy',calls)
        self.assertFalse(guard.closing(window)) # Cancel the failed-save close warning.
        with patch.object(module.threading, 'Thread') as worker:
            worker.side_effect=lambda target,daemon:SimpleNamespace(start=target)
            self.assertFalse(guard.closing(window))
        guard.finish_close(True)
        self.assertEqual(calls[-1],'destroy')
        self.assertTrue(guard.closing(window))

    def test_unresponsive_renderer_does_not_trap_the_window(self):
        guard=module.CloseGuard();guard._pending=True;guard._started=0
        window=SimpleNamespace(create_confirmation_dialog=lambda title,message:True)
        with patch.object(module.time,'monotonic',return_value=11):
            self.assertTrue(guard.closing(window))



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
        omit_revision = request_headers.pop("Omit-If-Match", False)
        if method == "PUT" and "If-Match" not in request_headers and not omit_revision:
            probe = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
            probe.request("GET", "/api/library", headers={"Host": f"127.0.0.1:{self.port}"})
            response = probe.getresponse()
            request_headers["If-Match"] = response.getheader("ETag")
            response.read()
            probe.close()
        body = json.dumps(value) if value is not None else None
        connection.request(method, path, body, request_headers)
        response = connection.getresponse()
        result = response.status, response.read(), dict(response.getheaders())
        connection.close()
        return result

    def test_reuses_only_known_legacy_library_and_never_overwrites_current(self):
        from server import migrate_windows_library, read_snapshot

        root = self.web.parent
        canonical = root / "Freezlit"
        legacy = root / "Recall"
        other = root / "Unrelated"
        other.mkdir()
        (other / "library.json").write_text('{"decks":[]}', encoding="utf-8")
        migrate_windows_library(canonical)
        self.assertFalse(canonical.exists())
        legacy.mkdir()
        original = '{"version":3,"decks":[{"title":"Future deck","cards":{"future":true}}]}'
        old = legacy / "library.json"
        old.write_text(original, encoding="utf-8")
        migrate_windows_library(canonical)
        self.assertEqual(read_snapshot(canonical)[0]["decks"][0]["title"], "Future deck")
        self.assertEqual((canonical / "library.json").read_bytes(), old.read_bytes())
        old.write_text('{"decks":[]}', encoding="utf-8")
        migrate_windows_library(canonical)
        self.assertEqual((canonical / "library.json").read_text(encoding="utf-8"), original)

    def test_incremental_state_reuses_known_legacy_library(self):
        legacy=self.root/'Recall';legacy.mkdir()
        value={'version':1,'decks':[{'id':'existing','title':'Existing deck','cards':[]}]}
        original=json.dumps(value).encode();(legacy/'library.json').write_bytes(original)
        self.server.migrate_legacy=True
        status,body,_=self.request(path='/api/state')
        self.assertEqual(status,200)
        self.assertEqual(json.loads(body)['decks'],value['decks'])
        self.assertEqual((self.folder/'library.json').read_bytes(),original)
        self.assertEqual((legacy/'library.json').read_bytes(),original)

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

    def test_revision_prevents_stale_window_overwrite(self):
        status, _, headers = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(headers["ETag"], '"empty"')
        first = {"version": 1, "decks": [{"id": "x", "cards": []}]}
        status, _, saved = self.request("PUT", value=first, headers={"If-Match": headers["ETag"]})
        self.assertEqual(status, 200)
        stale = self.request("PUT", value={"version": 1, "decks": []}, headers={"If-Match": headers["ETag"]})
        self.assertEqual(stale[0], 409)
        self.assertEqual(json.loads(self.request()[1]), first)
        self.assertNotEqual(saved["ETag"], headers["ETag"])

    def test_put_requires_a_valid_revision(self):
        self.assertEqual(self.request("PUT", value={"version": 1, "decks": []}, headers={"Omit-If-Match": True})[0], 428)
        self.assertEqual(self.request("PUT", value={"version": 1, "decks": []}, headers={"If-Match": "*"})[0], 400)
        self.assertFalse((self.folder / "library.json").exists())

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

