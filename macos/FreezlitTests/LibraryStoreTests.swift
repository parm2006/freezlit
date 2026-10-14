import XCTest
@testable import Freezlit

final class LibraryStoreTests: XCTestCase {
    private var directory: URL!
    private var store: LibraryStore!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("freezlit-tests-" + UUID().uuidString)
        store = try LibraryStore(directory: directory)
    }

    override func tearDownWithError() throws { try FileManager.default.removeItem(at: directory) }

    private func library(_ term: String) -> [String: Any] {
        ["version": 1, "decks": [["id": "native", "title": "Native test", "cards": [
            ["id": "card", "term": term, "definition": "coffee", "termImage": "data:image/png;base64,test",
             "additionalInfo": "A café serves coffee.", "schedule": ["forward": ["due": 42]]]
        ]]], "settings": [:], "history": [], "records": [:]]
    }

    func testNewLibraryIsNil() throws { XCTAssertNil(try store.load()) }

    func testUnicodeImagesAndProgressRoundTrip() throws {
        let value = library("café")
        try store.save(value)
        let loaded = try XCTUnwrap(store.load())
        XCTAssertEqual(loaded as NSDictionary, value as NSDictionary)
    }

    func testPreviousCopyRetained() throws {
        let first = library("first")
        try store.save(first)
        try store.save(library("second"))
        let previous = try JSONSerialization.jsonObject(with: Data(contentsOf: store.previousURL)) as? NSDictionary
        XCTAssertEqual(previous, first as NSDictionary)
    }

    func testMalformedSavePreservesExistingFile() throws {
        try store.save(library("safe"))
        let before = try Data(contentsOf: store.libraryURL)
        XCTAssertThrowsError(try store.save(["decks": [["cards": "bad"]]]))
        XCTAssertEqual(try Data(contentsOf: store.libraryURL), before)
    }

    func testStorageLimitRejectsBeforeWriting() throws {
        let smallStore = try LibraryStore(directory: directory, maxBytes: 128)
        XCTAssertThrowsError(try smallStore.save(library(String(repeating: "x", count: 200))))
        XCTAssertFalse(FileManager.default.fileExists(atPath: smallStore.libraryURL.path))
    }

    func testCorruptLibraryIsNotReplaced() throws {
        let corrupt = Data("not JSON".utf8)
        try corrupt.write(to: store.libraryURL)
        XCTAssertThrowsError(try store.load())
        XCTAssertEqual(try Data(contentsOf: store.libraryURL), corrupt)
    }
}
