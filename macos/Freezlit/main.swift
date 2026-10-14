import AppKit

// Retain the delegate explicitly: this app has no nib or storyboard wiring.
let application = NSApplication.shared
let applicationDelegate = AppDelegate()
application.delegate = applicationDelegate
application.run()
