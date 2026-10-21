import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: NSWindow?
    private var smokeRunner: NativeSmokeRunner?
    private var closeApproved = false
    private var terminationCheckInProgress = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hosted unit tests construct their own windows and isolated libraries.
        if NSClassFromString("XCTestCase") != nil { return }
        NSApp.setActivationPolicy(.regular)
        installMenu()
        do {
            let store = try LibraryStore(directory: LibraryStore.applicationDirectory())
            let controller = StudyViewController(store: store)
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 800),
                                  styleMask: [.titled, .closable, .miniaturizable, .resizable],
                                  backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false
            window.title = "Freezlit"
            window.contentMinSize = NSSize(width: 680, height: 580)
            window.contentViewController = controller
            window.delegate = self
            window.center()
            window.makeKeyAndOrderFront(nil)
            self.window = window
            NSApp.activate(ignoringOtherApps: true)
            if CommandLine.arguments.contains("--smoke-test") {
                guard let path = ProcessInfo.processInfo.environment["FREEZLIT_SMOKE_OUTPUT"],
                      ProcessInfo.processInfo.environment["FREEZLIT_DATA_DIR"] != nil else {
                    fputs("Diagnostic runs require isolated FREEZLIT_DATA_DIR and FREEZLIT_SMOKE_OUTPUT.\n", stderr)
                    exit(2)
                }
                smokeRunner = NativeSmokeRunner(controller: controller, outputDirectory: URL(fileURLWithPath: path))
                smokeRunner?.run()
            }
        } catch {
            let alert = NSAlert()
            alert.messageText = "Freezlit could not open local storage"
            alert.informativeText = error.localizedDescription
            alert.runModal()
            NSApp.terminate(nil)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        NSClassFromString("XCTestCase") == nil
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closeApproved { closeApproved = false; return true }
        guard let controller = sender.contentViewController as? StudyViewController else { return true }
        controller.flushPendingWork { [weak self, weak sender] saved in
            guard let self, let sender else { return }
            if saved {
                self.closeApproved = true
                sender.performClose(nil)
            } else {
                self.showSaveFailure()
            }
        }
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminationCheckInProgress { return .terminateCancel }
        terminationCheckInProgress = true
        guard let controller = window?.contentViewController as? StudyViewController else {
            terminationCheckInProgress = false
            return .terminateNow
        }
        controller.flushPendingWork { [weak self] saved in
            guard let self else { sender.reply(toApplicationShouldTerminate: false); return }
            self.terminationCheckInProgress = false
            if saved {
                sender.reply(toApplicationShouldTerminate: true)
            } else {
                self.showSaveFailure()
                sender.reply(toApplicationShouldTerminate: false)
            }
        }
        return .terminateLater
    }

    private func showSaveFailure() {
        let alert = NSAlert()
        alert.messageText = "Freezlit could not save your latest changes"
        alert.informativeText = "Keep the app open, use Retry local save, or export a backup before closing."
        alert.addButton(withTitle: "Keep Freezlit Open")
        if let window {
            alert.beginSheetModal(for: window) { _ in }
        } else {
            alert.runModal()
        }
    }

    private func installMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "Freezlit")
        appMenu.addItem(withTitle: "About Freezlit", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Freezlit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)
        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edit")
        for (title, selector, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"),
                                       ("Copy", "copy:", "c"), ("Paste", "paste:", "v"),
                                       ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: NSSelectorFromString(selector), keyEquivalent: key)
        }
        editItem.submenu = edit
        main.addItem(editItem)
        NSApp.mainMenu = main
    }
}
