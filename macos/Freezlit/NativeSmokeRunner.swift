import AppKit
import WebKit

private struct SmokeFailure: LocalizedError {
    let label: String
    var errorDescription: String? { label }
}

/// Explicit CI diagnostic mode runs the real application with an isolated data folder.
@MainActor
final class NativeSmokeRunner {
    private let controller: StudyViewController
    private let outputDirectory: URL
    private var checks: [String] = []

    init(controller: StudyViewController, outputDirectory: URL) {
        self.controller = controller
        self.outputDirectory = outputDirectory
    }

    func run() {
        Task { @MainActor in
            do {
                try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
                try await verify()
                try finish(passed: true)
                exit(0)
            } catch {
                try? finish(passed: false, error: error.localizedDescription)
                fputs("Native app smoke test failed: \(error.localizedDescription)\n", stderr)
                exit(1)
            }
        }
    }

    private func call(_ body: String, arguments: [String: Any] = [:]) async throws -> Any {
        try await controller.webView.callAsyncJavaScript(body, arguments: arguments, in: nil, contentWorld: .page) ?? NSNull()
    }

    private func wait(_ condition: String, _ label: String, seconds: Double = 15) async throws {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if let result = try? await call("return Boolean(\(condition));"), (result as? Bool) == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw SmokeFailure(label: label)
    }

    private func click(_ selector: String) async throws {
        _ = try await call("const button=document.querySelector(selector); if(!button) throw Error('Missing control: '+selector); button.click(); return true;", arguments: ["selector": selector])
    }

    private func value(_ selector: String, _ value: String) async throws {
        _ = try await call("const field=document.querySelector(selector); if(!field) throw Error('Missing field: '+selector); field.value=value; field.dispatchEvent(new Event('input',{bubbles:true})); return true;", arguments: ["selector": selector, "value": value])
    }

    private func screenshot(_ name: String) async throws {
        let image: NSImage = try await withCheckedThrowingContinuation { continuation in
            controller.webView.takeSnapshot(with: nil) { image, error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? SmokeFailure(label: "Native snapshot failed.")) }
            }
        }
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw SmokeFailure(label: "Native snapshot could not be encoded.")
        }
        try png.write(to: outputDirectory.appendingPathComponent(name), options: .atomic)
    }

    private func verify() async throws {
        try await wait("document.querySelector('.study-card')", "The bundled study page did not boot.")
        let initial = try await call("return await window.webkit.messageHandlers.freezlit.postMessage({action:'load'});") as? [String: Any]
        guard let decks = initial?["decks"] as? [[String: Any]], decks.count == 1,
              decks.first?["title"] as? String == "Active Recall",
              (decks.first?["cards"] as? [Any])?.count == 8 else {
            throw SmokeFailure(label: "The fresh native library did not contain only Active Recall's eight cards.")
        }
        checks.append("Actual native app boot; one eight-card Active Recall default deck; native local save")
        try await screenshot("macos-desktop.png")
        try await click("[data-action='flip']")
        try await wait("document.querySelector('.study-card')?.innerText.includes('Retrieving')", "Flashcard answer did not reveal.")
        checks.append("Native flashcard reveal")

        try await click("[data-mode='write']")
        try await click("[data-action='start']")
        try await value("#answer", "native intentional typo")
        _ = try await call("document.querySelector('#answer-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;")
        try await wait("document.querySelector('.feedback.failure') && document.querySelector('[data-action=\"accept-practice\"]')?.textContent==='I was correct'", "Wrong native Write answer did not offer correction.")
        try await click("[data-action='accept-practice']")
        try await wait("document.querySelector('.feedback.success') && document.querySelector('.session-top')?.textContent.includes('1 correct')", "Native Write correction did not count as correct.")
        try await wait("!document.querySelector('[data-action=\"accept-practice\"]')", "Native Write correction remained available twice.")
        try await Task.sleep(nanoseconds: 350_000_000)
        let practiced = try await call("return await window.webkit.messageHandlers.freezlit.postMessage({action:'load'});") as? [String: Any]
        let practiceHistory = (practiced?["history"] as? [[String: Any]])?.filter { $0["source"] as? String == "write" }
        guard practiceHistory?.count == 1, practiceHistory?.first?["ok"] as? Bool == true else {
            throw SmokeFailure(label: "Native Write correction did not replace its original history result.")
        }
        checks.append("Native Write wrong answer corrected through I was correct; one corrected history entry and one hit")

        // Use the actual editor and file-upload handler, with an isolated synthetic PNG.
        try await click("[data-action='edit-deck']")
        try await value("[data-draft='title']", "Active Recall · native proof")
        try await value("textarea[data-field='additionalInfo']", "Extra context stays outside the required answer.")
        _ = try await call("""
            const field=document.querySelector('[data-image-field="termImage"]');
            const canvas=document.createElement('canvas'); canvas.width=32;canvas.height=32;
            const ctx=canvas.getContext('2d');ctx.fillStyle='#236349';ctx.fillRect(0,0,32,32);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
            const transfer=new DataTransfer();transfer.items.add(new File([blob],'native-image.png',{type:'image/png'}));
            field.files=transfer.files;field.dispatchEvent(new Event('change',{bubbles:true}));return true;
            """)
        try await wait("document.querySelector('#editor-cards img')", "Native image input did not attach an image.")
        try await click("[data-action='save-deck']")
        try await wait("document.querySelector('h1')?.textContent==='Active Recall · native proof'", "Native deck edit did not save.")
        let edited = try await call("return await window.webkit.messageHandlers.freezlit.postMessage({action:'load'});") as? [String: Any]
        let cards = (edited?["decks"] as? [[String: Any]])?.first?["cards"] as? [[String: Any]]
        guard cards?.first?["additionalInfo"] as? String == "Extra context stays outside the required answer.",
              (cards?.first?["termImage"] as? String)?.hasPrefix("data:image/png;base64,") == true else {
            throw SmokeFailure(label: "Additional information or image was not persisted by native storage.")
        }
        checks.append("Native editor image attachment and additional-information persistence")

        try await click("[data-mode='test']")
        try await value("#test-count", "20")
        try await click("[data-action='start']")
        try await wait("document.querySelectorAll('.test-question').length===20", "The native test did not generate 20 questions from eight cards.")
        _ = try await call("""
            for(const element of document.querySelectorAll('#test-form input[type=text],#test-form input:not([type])')) {
              element.value='native proof answer';element.dispatchEvent(new Event('input',{bubbles:true}));
            }
            const first=document.querySelector('#test-form input[type=radio]');if(first){first.checked=true;first.dispatchEvent(new Event('change',{bubbles:true}));}
            return true;
            """)
        try await Task.sleep(nanoseconds: 350_000_000)
        try await click("[data-mode='write']")
        try await click("[data-mode='test']")
        try await wait("document.querySelectorAll('.test-question').length===20", "The test was lost when switching native study tabs.")
        _ = try await call("document.querySelector('#test-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;")
        try await wait("document.querySelector('.test-score')", "The native test did not grade.")
        let correction = try await call("""
            const button=[...document.querySelectorAll('[data-action="accept-answer"]')].find(button=>document.querySelector(`[name="q${button.dataset.question}"]`)?.type==='text');
            if(!button || button.textContent!=='I was correct') throw Error('Missing written test correction');
            const index=Number(button.dataset.question),input=document.querySelector(`[name="q${index}"]`).value;
            button.click();return {index,input};
            """) as? [String: Any]
        guard let correctedIndex = correction?["index"] as? Int, let originalInput = correction?["input"] as? String,
              originalInput == "native proof answer" else {
            throw SmokeFailure(label: "Native test correction did not target the original wrong written answer.")
        }
        try await wait("document.querySelectorAll('.test-question')[\(correctedIndex)]?.classList.contains('test-correct')", "Native test correction did not update grading.")
        try await Task.sleep(nanoseconds: 350_000_000)
        controller.webView.reload()
        try await wait("document.querySelector('.study-card')", "Native reload did not return to the default flashcard view.")
        try await click("[data-mode='test']")
        try await wait("document.querySelectorAll('.test-question').length===20 && document.querySelector('.test-score')", "The saved test and score were not restored after native reload.")
        try await wait("document.querySelectorAll('.test-question')[\(correctedIndex)]?.classList.contains('test-correct') && document.querySelector('[name=\"q\(correctedIndex)\"]')?.value==='native proof answer'", "Native reload lost test correction or replaced the original input.")
        let restored = try await call("return await window.webkit.messageHandlers.freezlit.postMessage({action:'load'});") as? [String: Any]
        let draft = (restored?["testDrafts"] as? [String: [String: Any]])?.values.first
        let restoredQuestions = draft?["questions"] as? [[String: Any]]
        guard restoredQuestions?[correctedIndex]["accepted"] as? Bool == true,
              restoredQuestions?[correctedIndex]["input"] as? String == originalInput else {
            throw SmokeFailure(label: "Native storage did not preserve accepted test grading and original input.")
        }
        checks.append("Exact 20-question test, tab persistence, grading, and accepted-answer reload persistence in WKWebView")

        controller.exportDestinationForTesting = outputDirectory.appendingPathComponent("native-export.json")
        _ = try await call("""
            const bridge=window.webkit.messageHandlers.freezlit;
            const library=await bridge.postMessage({action:'load'});
            return await bridge.postMessage({action:'export',library,name:'proof.json'});
            """)
        let exported = try Data(contentsOf: outputDirectory.appendingPathComponent("native-export.json"))
        let saved = try Data(contentsOf: controller.store.libraryURL)
        let exportedObject = try JSONSerialization.jsonObject(with: exported) as? NSDictionary
        let savedObject = try JSONSerialization.jsonObject(with: saved) as? NSDictionary
        guard exportedObject == savedObject, controller.exportRequests == 1 else {
            throw SmokeFailure(label: "Native export differs from saved library.")
        }
        checks.append("Native JSON export; automated diagnostic substitutes only the save destination")
        _ = try await call("return await window.webkit.messageHandlers.freezlit.postMessage({action:'cancelSpeech'});")
        checks.append("Native speech cancellation bridge")

        controller.view.window?.setContentSize(NSSize(width: 720, height: 760))
        try await Task.sleep(nanoseconds: 250_000_000)
        try await screenshot("macos-narrow.png")
        _ = try await call("location.href='https://example.invalid';return true;")
        try await Task.sleep(nanoseconds: 200_000_000)
        guard controller.isTrusted(controller.webView.url) else { throw SmokeFailure(label: "Outbound navigation was not denied.") }
        checks.append("Outbound navigation denied; actual desktop and narrow native snapshots captured")
    }

    private func finish(passed: Bool, error: String? = nil) throws {
        var report: [String: Any] = ["passed": passed, "checks": checks,
                                    "runtime": "AppKit + WKWebView", "isolatedData": true]
        if let error = error { report["error"] = error }
        let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: outputDirectory.appendingPathComponent("native-proof.json"), options: .atomic)
        print(String(data: data, encoding: .utf8) ?? "")
    }
}
