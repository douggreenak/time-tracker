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
    case offline

    var errorDescription: String? {
        switch self {
        case .message(let m), .unauthorized(let m): m
        case .offline: "Can't reach the server. Check your connection and try again."
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
        catch let e as URLError where e.code != .cancelled { throw APIError.offline }
        guard let http = resp as? HTTPURLResponse else { throw APIError.offline }
        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            if http.statusCode == 401 { throw APIError.unauthorized(msg ?? "Please sign in.") }
            throw APIError.message(msg ?? "Something went wrong (\(http.statusCode)).")
        }
        return data
    }

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:], as type: T.Type = T.self) async throws -> T {
        let d = try await raw("GET", path, query: query)
        let env = try JSONDecoder().decode(Envelope<T>.self, from: d)
        guard env.success, let v = env.data else { throw APIError.message(env.error ?? "Unexpected response.") }
        return v
    }

    /// For endpoints whose `data` may legitimately be null (e.g. no active timer, signed out).
    func getOptional<T: Decodable>(_ path: String, query: [String: String?] = [:], as type: T.Type = T.self) async throws -> T? {
        let d = try await raw("GET", path, query: query)
        let env = try JSONDecoder().decode(Envelope<T>.self, from: d)
        guard env.success else { throw APIError.message(env.error ?? "Unexpected response.") }
        return env.data
    }

    func send<T: Decodable>(_ method: String, _ path: String, body: [String: Any]? = nil, as type: T.Type = T.self) async throws -> T? {
        let d = try await raw(method, path, body: body)
        let env = try JSONDecoder().decode(Envelope<T>.self, from: d)
        guard env.success else { throw APIError.message(env.error ?? "Unexpected response.") }
        return env.data
    }

    func clearSession() {
        HTTPCookieStorage.shared.cookies(for: ServerConfig.url)?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
    }
}
