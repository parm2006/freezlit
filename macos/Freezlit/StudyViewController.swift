import AppKit
import AVFoundation
import UniformTypeIdentifiers
import WebKit

private final class BridgeHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var owner: StudyViewController?

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let owner = owner else { replyHandler(nil, "The study window is closed."); return }
        owner.receive(message, reply: replyHandler)
    }
}

final class StudyViewController: NSViewController, WKNavigationDelegate, WKUIDelegate {
    let store: LibraryStore
    let webDirectory: URL
    private let bridge = BridgeHandler()
    private let storageQueue = DispatchQueue(label: "freezlit.local-storage")
    private let speech = AVSpeechSynthesizer()
    private(set) var webView: WKWebView!
    // Set only by the app's explicit diagnostic runner or native tests, never by JavaScript.
    var exportDestinationForTesting: URL?
    private(set) var exportRequests = 0

    init(store: LibraryStore, webDirectory: URL? = nil) {
        self.store = store
        self.webDirectory = (webDirectory ?? Bundle.main.resourceURL!.appendingPathComponent("Web", isDirectory: true))
            .standardizedFileURL
        super.init(nibName: nil, bundle: nil)
        bridge.owner = self
    }

    required init?(coder: NSCoder) { fatalError("Use init(store:).") }

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "freezlit")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1180, height: 800), configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setAccessibilityIdentifier("freezlit-web")
        view = webView
        let index = webDirectory.appendingPathComponent("index.html")
        webView.loadFileURL(index, allowingReadAccessTo: webDirectory)
    }

    func isTrusted(_ url: URL?) -> Bool {
        guard let url = url, url.isFileURL else { return false }
        let path = url.standardizedFileURL.path
        return path.hasPrefix(webDirectory.path + "/")
    }

    private func trustedFrame(_ frame: WKFrameInfo) -> Bool {
        frame.isMainFrame && isTrusted(frame.request.url)
    }

    func receive(_ message: WKScriptMessage, reply: @escaping (Any?, String?) -> Void) {
        guard message.webView === webView, trustedFrame(message.frameInfo),
              let body = message.body as? [String: Any], let action = body["action"] as? String else {
            reply(nil, "Only the bundled study page can use local storage.")
            return
        }
        switch action {
        case "load":
            storageQueue.async { [store] in
                do {
                    let snapshot = try store.loadSnapshot()
                    let library: Any = snapshot.library.map { $0 as Any } ?? NSNull()
                    let result: Any = ["library": library, "revision": snapshot.revision]
                    DispatchQueue.main.async { reply(result, nil) }
                } catch { DispatchQueue.main.async { reply(nil, error.localizedDescription) } }
            }
        case "save":
            guard let library = body["library"], let expectedRevision = body["expectedRevision"] as? String else {
                reply(nil, "A library and storage revision are required."); return
            }
            storageQueue.async { [store] in
                do {
                    let revision = try store.save(library, expectedRevision: expectedRevision)
                    DispatchQueue.main.async { reply(["ok": true, "revision": revision], nil) }
                } catch LibraryError.conflict {
                    DispatchQueue.main.async { reply(["ok": false, "code": "conflict", "error": LibraryError.conflict.localizedDescription], nil) }
                } catch { DispatchQueue.main.async { reply(["ok": false, "error": error.localizedDescription], nil) } }
            }
        case "export":
            guard let library = body["library"] else { reply(nil, "A library is required."); return }
            do {
                let data = try store.encode(library, enforceLimit: false)
                export(data, name: body["name"] as? String ?? "freezlit-library.json", reply: reply)
            } catch { reply(nil, error.localizedDescription) }
        case "speak":
            guard let text = body["text"] as? String, text.count <= 50_000 else {
                reply(nil, "Speech needs text shorter than 50,000 characters."); return
            }
            speech.stopSpeaking(at: .immediate)
            let utterance = AVSpeechUtterance(string: text)
            if let language = body["language"] as? String {
                utterance.voice = AVSpeechSynthesisVoice(language: language)
            }
            speech.speak(utterance)
            reply(["ok": true], nil)
        case "cancelSpeech":
            speech.stopSpeaking(at: .immediate)
            reply(["ok": true], nil)
        default: reply(nil, "Unsupported native action.")
        }
    }

    private func export(_ data: Data, name: String, reply: @escaping (Any?, String?) -> Void) {
        exportRequests += 1
        if let destination = exportDestinationForTesting {
            do { try store.writePrivate(data, to: destination); reply(["ok": true], nil) }
            catch { reply(nil, error.localizedDescription) }
            return
        }
        guard let window = view.window, window.attachedSheet == nil else {
            reply(nil, "Close the current dialog before exporting."); return
        }
        let panel = NSSavePanel()
        let component = String((name as NSString).lastPathComponent.prefix(180))
        panel.nameFieldStringValue = component.hasSuffix(".json") ? component : component + ".json"
        panel.allowedContentTypes = [.json]
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { [store] response in
            guard response == .OK, let url = panel.url else {
                reply(["ok": false, "cancelled": true], nil); return
            }
            do { try store.writePrivate(data, to: url); reply(["ok": true], nil) }
            catch { reply(nil, error.localizedDescription) }
        }
    }

    /// Wait for the page's debounced edits, drafts, and test answers before native close/quit.
    func flushPendingWork(completion: @escaping (Bool) -> Void) {
        guard isViewLoaded, webView != nil else { completion(true); return }
        webView.callAsyncJavaScript(
            "return window.freezlitFlushPendingWork ? await window.freezlitFlushPendingWork() : true",
            arguments: [:], in: nil, contentWorld: .page
        ) { result in
            if case .success(let value) = result, (value as? Bool) == true {
                completion(true)
            } else {
                completion(false)
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(isTrusted(navigationAction.request.url) && navigationAction.targetFrame?.isMainFrame != false
                        ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard trustedFrame(frame), let window = view.window, window.attachedSheet == nil else {
            completionHandler(false); return
        }
        let alert = NSAlert()
        alert.messageText = "Freezlit"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard trustedFrame(frame), let window = view.window, window.attachedSheet == nil else {
            completionHandler(); return
        }
        let alert = NSAlert()
        alert.messageText = "Freezlit"
        alert.informativeText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard trustedFrame(frame), let window = view.window, window.attachedSheet == nil else {
            completionHandler(nil); return
        }
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }
}
