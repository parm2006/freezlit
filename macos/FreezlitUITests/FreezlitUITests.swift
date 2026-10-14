import XCTest

final class FreezlitUITests: XCTestCase {
    func testRealApplicationWindowAndFlashcardReveal() throws {
        let app = XCUIApplication()
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("freezlit-ui-" + UUID().uuidString)
        app.launchEnvironment["FREEZLIT_DATA_DIR"] = directory.path
        app.launch()
        defer { app.terminate(); try? FileManager.default.removeItem(at: directory) }
        XCTAssertTrue(app.windows["Freezlit"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        let reveal = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Reveal answer")).firstMatch
        XCTAssertTrue(reveal.waitForExistence(timeout: 20), "The HTML flashcard must remain accessible in the native window.")
        reveal.click()
        let answer = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Retrieving information")).firstMatch
        XCTAssertTrue(answer.waitForExistence(timeout: 10))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Freezlit native macOS window"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
