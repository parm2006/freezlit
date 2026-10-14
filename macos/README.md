# Freezlit for macOS

The Mac edition is a native AppKit application using the system WKWebView.
Cards, images, tests, and progress stay on the Mac. It runs without Python,
pip, Node.js, a local server, or a WebView2 installation.

## Install a verified build

Requires macOS 13 or later. The universal app supports Apple Silicon and
Intel Macs. Open the DMG and drag Freezlit to Applications, or extract the
ZIP and move Freezlit.app to Applications. Then launch Freezlit.

The downloadable app is ad hoc signed, not Developer ID signed or
notarized. No Apple Developer membership was used. macOS may block an
internet-downloaded build until you approve it in System Settings >
Privacy & Security > Open Anyway after attempting to launch. Only approve
a build whose source and download you trust. There is no App Store release.

The Mac download is separate from the Windows executable. Windows ZIP
files cannot run natively on macOS.

## Local data and native integration

Your library is saved to
`~/Library/Application Support/Freezlit/library.json`, with
`library.previous.json` retained after each successful update. Storage is
written atomically, uses private file permissions, and has a 100 MB limit.
The app does not silently replace an unreadable library.

Export opens the Mac save panel and writes a complete JSON backup. Import
and image inputs use the Mac file picker. Speech uses system voices.
Deletion and editor confirmation use native Mac alerts. Existing Windows
JSON exports can be imported through the shared interface, including
images and progress; Windows data is not automatically copied to the Mac.

The JavaScript bridge accepts only messages from the bundled main-frame
file page. Outbound navigation is denied. The offline web bundle has no
network connection permission in its Content Security Policy.

## Build and test from source on a Mac

Install Xcode with its command-line tools, Node.js 22+, and XcodeGen.
No Apple Developer membership is needed for these local build commands.

```sh
npm ci
npm test
npm run native:web
swift macos/tools/render-icon.swift macos/Freezlit/AppIcon.iconset
iconutil -c icns macos/Freezlit/AppIcon.iconset -o macos/Freezlit/AppIcon.icns
xcodegen generate --spec macos/project.yml
xcodebuild -project macos/Freezlit.xcodeproj -scheme Freezlit \
  -destination "platform=macOS,arch=$(uname -m)" \
  -derivedDataPath build/macos-tests CODE_SIGNING_ALLOWED=NO test
xcodebuild -project macos/Freezlit.xcodeproj -scheme Freezlit -configuration Release \
  -destination 'generic/platform=macOS' -derivedDataPath build/macos-release \
  CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=NO ARCHS='arm64 x86_64' build
codesign --force --deep --sign - build/macos-release/Build/Products/Release/Freezlit.app
```

The result is
`build/macos-release/Build/Products/Release/Freezlit.app`.

The GitHub macOS workflow runs native XCTest and XCUITest checks, builds
the universal app, launches the actual release app with isolated test
data, and captures native WKWebView snapshots and a JSON proof report.
It creates ZIP/DMG artifacts only after those checks pass. A successful
Windows or browser test alone does not establish that the Mac app builds
or runs. Check the macOS workflow result before calling a build verified.

The app's explicit `--smoke-test` mode requires both `FREEZLIT_DATA_DIR`
and `FREEZLIT_SMOKE_OUTPUT` to keep diagnostics separate from study data.
Its native export check substitutes the automated save destination; normal
use opens NSSavePanel. The macOS tests do not establish notarization,
App Store eligibility, or compatibility with every installed speech voice.
