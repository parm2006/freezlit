import Foundation

enum LibraryError: LocalizedError {
    case invalidLibrary
    case tooLarge

    var errorDescription: String? {
        switch self {
        case .invalidLibrary: return "The library must contain decks and cards. Your existing file has been preserved."
        case .tooLarge: return "The library exceeds the 100 MB limit. Export a backup and reduce large images."
        }
    }
}

/// Accessed on the controller's serial storage queue. Native tests use separate directories.
final class LibraryStore {
    let directory: URL
    let maxBytes: Int
    var libraryURL: URL { directory.appendingPathComponent("library.json") }
    var previousURL: URL { directory.appendingPathComponent("library.previous.json") }

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

    func encode(_ value: Any) throws -> Data {
        guard let library = value as? [String: Any], let decks = library["decks"] as? [[String: Any]],
              decks.count <= 10_000, JSONSerialization.isValidJSONObject(library) else {
            throw LibraryError.invalidLibrary
        }
        for deck in decks {
            guard deck["cards"] is [[String: Any]] else { throw LibraryError.invalidLibrary }
        }
        let data = try JSONSerialization.data(withJSONObject: library, options: [.sortedKeys])
        guard data.count <= maxBytes else { throw LibraryError.tooLarge }
        return data
    }

    func load() throws -> [String: Any]? {
        guard FileManager.default.fileExists(atPath: libraryURL.path) else { return nil }
        let data = try Data(contentsOf: libraryURL, options: [.mappedIfSafe])
        guard data.count <= maxBytes else { throw LibraryError.tooLarge }
        let value = try JSONSerialization.jsonObject(with: data)
        _ = try encode(value)
        return value as? [String: Any]
    }

    func save(_ value: Any) throws {
        let data = try encode(value)
        if FileManager.default.fileExists(atPath: libraryURL.path) {
            let previous = try Data(contentsOf: libraryURL, options: [.mappedIfSafe])
            try writePrivate(previous, to: previousURL)
        }
        try writePrivate(data, to: libraryURL)
    }

    func writePrivate(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}
