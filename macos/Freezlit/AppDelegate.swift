import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var smokeRunner: NativeSmokeRunner?

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
            window.title = "Freezlit"
            window.contentMinSize = NSSize(width: 680, height: 580)
            window.contentViewController = controller
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
