import Foundation

/// Where the cloud backend lives. Change it on the sign-in screen's "Server" row if it ever moves.
enum ServerConfig {
    static let defaultURL = "https://timetracker.apexengineeringak.com"
    static let key = "serverURL"

    static var url: URL {
        let raw = UserDefaults.standard.string(forKey: key)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return URL(string: raw.isEmpty ? defaultURL : raw) ?? URL(string: defaultURL)!
    }
}

enum APIError: LocalizedError {
    case message(String)
    case unauthorized(String)
    case offline(String)
    case badResponse(String)

    var errorDescription: String? {
        switch self {
        case .message(let m), .unauthorized(let m): m
        case .offline(let host): "Can't reach \(host). Check your internet connection and try again."
        case .badResponse(let what): "The server sent something the app couldn't read (\(what)). Try again, and update the app if it keeps happening."
        }
    }
}

/// Thin async wrapper over the REST API. The session cookie is kept by URLSession's shared cookie storage,
/// so a sign-in survives app restarts (the server's cookie lasts 14 days).
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.httpCookieStorage = .shared
        c.httpCookieAcceptPolicy = .always
        c.httpShouldSetCookies = true
        c.timeoutIntervalForRequest = 30
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    private struct ErrorBody: Decodable { let error: String? }

    func raw(_ method: String, _ path: String, query: [String: String?] = [:], body: [String: Any]? = nil) async throws -> Data {
        var comps = URLComponents(url: ServerConfig.url.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { k, v in v.map { URLQueryItem(name: k, value: $0) } }
        if !items.isEmpty { comps.queryItems = items }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) }
        catch let e as URLError where e.code != .cancelled { throw APIError.offline(ServerConfig.url.host() ?? "the server") }
        guard let http = resp as? HTTPURLResponse else { throw APIError.offline(ServerConfig.url.host() ?? "the server") }
        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            if http.statusCode == 401 { throw APIError.unauthorized(msg ?? "Please sign in.") }
            if http.statusCode >= 500 { throw APIError.message(msg.map { "The server had a problem: \($0) (\(http.statusCode))." } ?? "The server had a problem (\(http.statusCode)). Try again in a moment.") }
            throw APIError.message(msg ?? "Something went wrong (\(http.statusCode)).")
        }
        return data
    }

    private func envelope<T: Decodable>(_ d: Data, _ path: String, _ type: T.Type) throws -> Envelope<T> {
        do { return try JSONDecoder().decode(Envelope<T>.self, from: d) }
        catch { throw APIError.badResponse("\(path): \(Self.describe(error))") }
    }

    private static func describe(_ e: Error) -> String {
        guard let e = e as? DecodingError else { return e.localizedDescription }
        switch e {
        case .keyNotFound(let k, _): return "missing \(k.stringValue)"
        case .typeMismatch(_, let c), .valueNotFound(_, let c): return "unexpected value at \(c.codingPath.map(\.stringValue).joined(separator: "."))"
        case .dataCorrupted: return "not valid data"
        @unknown default: return "unreadable"
        }
    }

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:], as type: T.Type = T.self) async throws -> T {
        let d = try await raw("GET", path, query: query)
        let env = try envelope(d, path, T.self)
        guard env.success, let v = env.data else { throw APIError.message(env.error ?? "Unexpected response.") }
        return v
    }

    /// For endpoints whose `data` may legitimately be null (e.g. no active timer, signed out).
    func getOptional<T: Decodable>(_ path: String, query: [String: String?] = [:], as type: T.Type = T.self) async throws -> T? {
        let d = try await raw("GET", path, query: query)
        let env = try envelope(d, path, T.self)
        guard env.success else { throw APIError.message(env.error ?? "Unexpected response.") }
        return env.data
    }

    func send<T: Decodable>(_ method: String, _ path: String, body: [String: Any]? = nil, as type: T.Type = T.self) async throws -> T? {
        let d = try await raw(method, path, body: body)
        let env = try envelope(d, path, T.self)
        guard env.success else { throw APIError.message(env.error ?? "Unexpected response.") }
        return env.data
    }

    func clearSession() {
        HTTPCookieStorage.shared.cookies(for: ServerConfig.url)?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
    }
}
