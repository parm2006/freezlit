import Foundation
import CryptoKit
import Darwin

enum LibraryError: LocalizedError {
    case invalidLibrary
    case tooLarge
    case conflict

    var errorDescription: String? {
        switch self {
        case .invalidLibrary: return "The library must contain decks and cards. Your existing file has been preserved."
        case .tooLarge: return "The library exceeds the 100 MB limit. Export a backup and reduce large images."
        case .conflict: return "This library changed in another window. Export your changes before reloading."
        }
    }
}

/// Accessed on the controller's serial storage queue. Native tests use separate directories.
final class LibraryStore {
    let directory: URL
    let maxBytes: Int
    var libraryURL: URL { directory.appendingPathComponent("library.json") }
    var previousURL: URL { directory.appendingPathComponent("library.previous.json") }
    private var lockURL: URL { directory.appendingPathComponent(".library.lock") }
    private static let processLock = NSLock()

    static func applicationDirectory() throws -> URL {
        if let override = ProcessInfo.processInfo.environment["FREEZLIT_DATA_DIR"], !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: true)
        }
        return try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                           appropriateFor: nil, create: true)
            .appendingPathComponent("Freezlit", isDirectory: true)
    }

    init(directory: URL, maxBytes: Int = 100 * 1024 * 1024) throws {
        self.directory = directory.standardizedFileURL
        self.maxBytes = maxBytes
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: self.directory.path)
    }

    func encode(_ value: Any, enforceLimit: Bool = true) throws -> Data {
        guard let library = value as? [String: Any], let decks = library["decks"] as? [[String: Any]],
              decks.count <= 10_000, JSONSerialization.isValidJSONObject(library) else {
            throw LibraryError.invalidLibrary
        }
        for deck in decks {
            guard deck["cards"] is [[String: Any]] else { throw LibraryError.invalidLibrary }
        }
        let data = try JSONSerialization.data(withJSONObject: library, options: [.sortedKeys])
        if enforceLimit && data.count > maxBytes { throw LibraryError.tooLarge }
        return data
    }

    private func withLock<T>(_ operation: () throws -> T) throws -> T {
        Self.processLock.lock()
        defer { Self.processLock.unlock() }
        let fd = open(lockURL.path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard fd >= 0 else { throw POSIXError(.EACCES) }
        guard flock(fd, LOCK_EX) == 0 else { close(fd); throw POSIXError(.EIO) }
        defer { _ = flock(fd, LOCK_UN); close(fd) }
        return try operation()
    }

    private func revision(_ data: Data?) -> String {
        guard let data else { return "empty" }
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    func loadSnapshot() throws -> (library: [String: Any]?, revision: String) {
        try withLock {
            guard FileManager.default.fileExists(atPath: libraryURL.path) else { return (nil, "empty") }
            let data = try Data(contentsOf: libraryURL, options: [.mappedIfSafe])
            guard data.count <= maxBytes else { throw LibraryError.tooLarge }
            let value = try JSONSerialization.jsonObject(with: data)
            _ = try encode(value)
            guard let library = value as? [String: Any] else { throw LibraryError.invalidLibrary }
            return (library, revision(data))
        }
    }

    func load() throws -> [String: Any]? {
        try loadSnapshot().library
    }

    @discardableResult
    func save(_ value: Any, expectedRevision: String? = nil) throws -> String {
        let data = try encode(value)
        return try withLock {
            let current = try FileManager.default.fileExists(atPath: libraryURL.path)
                ? Data(contentsOf: libraryURL, options: [.mappedIfSafe]) : nil
            if let expectedRevision, expectedRevision != revision(current) { throw LibraryError.conflict }
            if let current { try writePrivate(current, to: previousURL) }
            try writePrivate(data, to: libraryURL)
            return revision(data)
        }
    }

    func writePrivate(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}
