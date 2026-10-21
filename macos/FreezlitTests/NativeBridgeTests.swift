import AppKit
import WebKit
import XCTest
@testable import Freezlit

final class NativeBridgeTests: XCTestCase {
    @MainActor
    private func call(_ webView: WKWebView, _ script: String) async throws -> Any {
        try await webView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page) ?? NSNull()
    }

    @MainActor
    func testBundledWebPageAndNativeBridgeRoundTrip() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("freezlit-bridge-" + UUID().uuidString)
        let store = try LibraryStore(directory: directory)
        let controller = StudyViewController(store: store)
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 760),
                              styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentViewController = controller
        window.makeKeyAndOrderFront(nil)
        defer { window.close(); try? FileManager.default.removeItem(at: directory) }
        let deadline = Date().addingTimeInterval(20)
        var ready = false
        while Date() < deadline {
            if (try? await call(controller.webView, "return !!document.querySelector('.study-card');")) as? Bool == true {
                ready = true; break
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready, "The real bundled WKWebView did not boot.")
        let initial = try await call(controller.webView, "return await window.webkit.messageHandlers.freezlit.postMessage({action:'load'});") as? [String: Any]
        let loadedLibrary = try XCTUnwrap(initial?["library"] as? [String: Any])
        let initialRevision = try XCTUnwrap(initial?["revision"] as? String)
        let decks = try XCTUnwrap(loadedLibrary["decks"] as? [[String: Any]])
        XCTAssertEqual(decks.count, 1)
        XCTAssertEqual(decks.first?["title"] as? String, "Active Recall")
        XCTAssertEqual((decks.first?["cards"] as? [Any])?.count, 8)
        let result = try await call(controller.webView, """
            const handler=window.webkit.messageHandlers.freezlit;
            const snapshot=await handler.postMessage({action:'load'}), value=snapshot.library;
            value.decks[0].title='Native bridge saved café';
            const saved=await handler.postMessage({action:'save',library:value,expectedRevision:snapshot.revision});
            const loaded=await handler.postMessage({action:'load'});
            return {ok:saved.ok,title:loaded.library.decks[0].title};
            """) as? [String: Any]
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["title"] as? String, "Native bridge saved café")
        XCTAssertTrue(FileManager.default.fileExists(atPath: store.previousURL.path))
        let rejected = try await call(controller.webView, """
            try { await window.webkit.messageHandlers.freezlit.postMessage({action:'save',library:{bad:true},expectedRevision:'\(initialRevision)'});return false; }
            catch(error) { return true; }
            """) as? Bool
        XCTAssertEqual(rejected, true)
        controller.exportDestinationForTesting = directory.appendingPathComponent("export.json")
        let exported = try await call(controller.webView, """
            const handler=window.webkit.messageHandlers.freezlit;
            const snapshot=await handler.postMessage({action:'load'});
            return await handler.postMessage({action:'export',library:snapshot.library,name:'backup.json'});
            """) as? [String: Any]
        XCTAssertEqual(exported?["ok"] as? Bool, true)
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent("export.json")),
                       try Data(contentsOf: store.libraryURL))
        let cancelled = try await call(controller.webView, "return await window.webkit.messageHandlers.freezlit.postMessage({action:'cancelSpeech'});") as? [String: Any]
        XCTAssertEqual(cancelled?["ok"] as? Bool, true)
        XCTAssertTrue(controller.isTrusted(controller.webDirectory.appendingPathComponent("index.html")))
        XCTAssertFalse(controller.isTrusted(URL(string: "https://example.invalid")))
        XCTAssertFalse(controller.isTrusted(directory.appendingPathComponent("library.json")))
        XCTAssertFalse(controller.isTrusted(URL(fileURLWithPath: controller.webDirectory.path + "-evil/index.html")))
    }
}
