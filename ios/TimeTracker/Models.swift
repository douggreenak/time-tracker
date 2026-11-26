import Foundation

// MARK: - Server models (mirror the Next.js REST API)

struct AppUser: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var email: String
    var role: String
    var qbEmployeeName: String?
    var defaultHourlyRate: Double?

    var isManager: Bool { role == "accountant" || role == "admin" }
    var isAdmin: Bool { role == "admin" }
    var roleLabel: String { role.capitalized }

    enum CodingKeys: String, CodingKey { case id, name, email, role, qbEmployeeName, defaultHourlyRate }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        email = (try? c.decode(String.self, forKey: .email)) ?? ""
        role = (try? c.decode(String.self, forKey: .role)) ?? "engineer"
        qbEmployeeName = try? c.decode(String.self, forKey: .qbEmployeeName)
        if let d = try? c.decode(Double.self, forKey: .defaultHourlyRate) { defaultHourlyRate = d }
        else if let s = try? c.decode(String.self, forKey: .defaultHourlyRate) { defaultHourlyRate = Double(s) }
    }
}

struct LoginPerson: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let role: String
}

struct LoginDirectory: Codable {
    let users: [LoginPerson]
    let isDemo: Bool
    let needsSetup: Bool
}

struct Customer: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var isActive: Bool
    var lastInvoiceDate: String?

    enum CodingKeys: String, CodingKey { case id, name, isActive, lastInvoiceDate }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        isActive = (try? c.decode(Bool.self, forKey: .isActive)) ?? true
        lastInvoiceDate = try? c.decode(String.self, forKey: .lastInvoiceDate)
    }
}

/// Where a piece of time stands in billing (the web app's invoice flow).
enum EntryStatus: String, CaseIterable {
    case open, held, invoiced
    var label: String {
        switch self {
        case .open: "Not invoiced"
        case .held: "Held"
        case .invoiced: "Invoiced"
        }
    }
}

struct TimeEntry: Identifiable, Hashable {
    let id: String
    var userId: String
    var userName: String?
    var customerId: String?
    var customerName: String?
    var date: String
    var durationMinutes: Int
    var notes: String?
    var isLumpSum: Bool
    var partsNote: String?
    var internalNote: String?
    var contractPo: String?
    var isBillable: Bool
    var isInvoiced: Bool
    var invoicedOn: String?
    var isHeld: Bool

    var statusValue: EntryStatus { isInvoiced ? .invoiced : (isHeld ? .held : .open) }
    var isLocked: Bool { isInvoiced }
    var hasParts: Bool { !(partsNote ?? "").trimmingCharacters(in: .whitespaces).isEmpty }

    /// The customer's name, or a friendly fallback.
    var title: String {
        let c = (customerName ?? "").trimmingCharacters(in: .whitespaces)
        return c.isEmpty ? "No customer" : c
    }
    /// What was done (the workbook's DESCRIPTION column).
    var subtitle: String {
        let t = (notes ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? (isLumpSum ? "Lump sum" : "No description") : t
    }
}

extension TimeEntry: Decodable {
    enum CodingKeys: String, CodingKey {
        case id, userId, userName, customerId, customerName, date, durationMinutes, notes
        case isLumpSum, partsNote, internalNote, contractPo, isBillable, isInvoiced, invoicedOn, isHeld
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decode(String.self, forKey: .userId)
        userName = try? c.decode(String.self, forKey: .userName)
        let cid = try? c.decode(String.self, forKey: .customerId)
        customerId = (cid?.isEmpty ?? true) ? nil : cid
        customerName = try? c.decode(String.self, forKey: .customerName)
        date = try c.decode(String.self, forKey: .date)
        durationMinutes = try c.decode(Int.self, forKey: .durationMinutes)
        notes = try? c.decode(String.self, forKey: .notes)
        isLumpSum = (try? c.decode(Bool.self, forKey: .isLumpSum)) ?? false
        partsNote = try? c.decode(String.self, forKey: .partsNote)
        internalNote = try? c.decode(String.self, forKey: .internalNote)
        contractPo = try? c.decode(String.self, forKey: .contractPo)
        isBillable = (try? c.decode(Bool.self, forKey: .isBillable)) ?? true
        isInvoiced = (try? c.decode(Bool.self, forKey: .isInvoiced)) ?? false
        invoicedOn = try? c.decode(String.self, forKey: .invoicedOn)
        isHeld = (try? c.decode(Bool.self, forKey: .isHeld)) ?? false
    }
}

/// The stopwatch lives on the device (the server has no timer); stopping it saves an entry.
struct LocalTimer: Codable, Hashable {
    var userId: String
    var customerId: String
    var notes: String
    var startedAt: Date
    var elapsedBeforePause: Int    // seconds
    var isRunning: Bool
}

// MARK: - Envelope

struct Envelope<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: String?
}

struct Empty: Decodable {}

// MARK: - Date + duration helpers

enum Fmt {
    static let ymd: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let gregorian: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 1
        return c
    }()
    private static let shortDay: DateFormatter = {
        let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("MMM d"); return f
    }()
    private static let weekdayNumber: DateFormatter = {
        let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("EEE d"); return f
    }()
    private static var weekStartCache: [String: String] = [:]

    /// Time is billed in tenths of an hour, so minutes snap to 0, 6, 12 … 54.
    static func snapToTenth(_ minutes: Int) -> Int { min(54, Int((Double(minutes) / 6).rounded()) * 6) }

    static func date(_ s: String) -> Date { ymd.date(from: s) ?? Date() }
    static func string(_ d: Date) -> String { ymd.string(from: d) }
    static var today: String { string(Date()) }

    /// Pay weeks run Sunday–Saturday, like the web app.
    static func weekStart(_ s: String) -> String {
        if let hit = weekStartCache[s] { return hit }
        let d = date(s)
        let start = gregorian.date(from: gregorian.dateComponents([.yearForWeekOfYear, .weekOfYear], from: d)) ?? d
        let result = string(start)
        weekStartCache[s] = result
        return result
    }

    static func weekLabel(_ start: String) -> String {
        let a = date(start)
        let b = Calendar.current.date(byAdding: .day, value: 6, to: a) ?? a
        return "\(shortDay.string(from: a)) – \(shortDay.string(from: b))"
    }

    static func weekTag(_ start: String) -> String? {
        let now = weekStart(today)
        if start == now { return "This week" }
        let last = Calendar.current.date(byAdding: .day, value: -7, to: date(now)).map(string)
        return start == last ? "Last week" : nil
    }

    static func dayLabel(_ s: String) -> String {
        return weekdayNumber.string(from: date(s))
    }

    static func longDay(_ s: String) -> String {
        date(s).formatted(.dateTime.weekday(.wide).month().day())
    }

    /// 90 -> "1h 30m"
    static func duration(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        if h == 0 { return "\(m)m" }
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }

    /// 90 -> "1.5"
    static func hours(_ minutes: Int) -> String {
        let v = Double(minutes) / 60
        return v.formatted(.number.precision(.fractionLength(0...2)))
    }

    static func clock(_ seconds: Int) -> String {
        let s = max(0, seconds)
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}
