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

struct Job: Codable, Identifiable, Hashable {
    let id: String
    let customerId: String
    var name: String
    var isActive: Bool
}

struct Customer: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var qbName: String?
    var isActive: Bool
    var jobs: [Job]

    enum CodingKeys: String, CodingKey { case id, name, qbName, isActive, jobs }

    // The server no longer sends projects (`jobs`), so default to none.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        qbName = try? c.decode(String.self, forKey: .qbName)
        isActive = (try? c.decode(Bool.self, forKey: .isActive)) ?? true
        jobs = (try? c.decode([Job].self, forKey: .jobs)) ?? []
    }
}

struct ServiceItem: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var qbItemName: String?
    var defaultBillable: Bool
}

struct FlagNote: Codable, Hashable {
    let at: String
    let by: String
    let kind: String
    let text: String
}

enum EntryStatus: String, CaseIterable {
    case draft, submitted, approved, exported
    var label: String { self == .exported ? "In QuickBooks" : rawValue.capitalized }
}

enum LocationKind: String, CaseIterable, Identifiable {
    case office, on_site, remote, travel
    var id: String { rawValue }
    var label: String {
        switch self {
        case .office: "Office"
        case .on_site: "On-site"
        case .remote: "Remote"
        case .travel: "Travel"
        }
    }
    var icon: String {
        switch self {
        case .office: "building.2"
        case .on_site: "mappin.and.ellipse"
        case .remote: "house"
        case .travel: "car"
        }
    }
}

struct TimeEntry: Codable, Identifiable, Hashable {
    let id: String
    var userId: String
    var userName: String?
    var customerId: String?
    var customerName: String?
    var jobId: String?
    var jobName: String?
    var serviceItemId: String?
    var serviceItemName: String?
    var date: String
    var durationMinutes: Int
    var locationType: String
    var locationName: String?
    var notes: String?
    var isBillable: Bool
    var status: String
    var flagged: Bool?
    var flagReason: String?
    var flagHistory: [FlagNote]?
    var isInvoiced: Bool?
    var isHeld: Bool?

    enum CodingKeys: String, CodingKey {
        case id, userId, userName, customerId, customerName, jobId, jobName, serviceItemId, serviceItemName
        case date, durationMinutes, locationType, locationName, notes, isBillable, status
        case flagged, flagReason, flagHistory, isInvoiced, isHeld
    }

    // The server's entries no longer carry task / location / status, so fall back to sensible defaults:
    // invoiced time shows as locked ("In QuickBooks" label), everything else as a plain draft.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decode(String.self, forKey: .userId)
        userName = try? c.decode(String.self, forKey: .userName)
        customerId = try? c.decode(String.self, forKey: .customerId)
        customerName = try? c.decode(String.self, forKey: .customerName)
        jobId = try? c.decode(String.self, forKey: .jobId)
        jobName = try? c.decode(String.self, forKey: .jobName)
        serviceItemId = try? c.decode(String.self, forKey: .serviceItemId)
        serviceItemName = try? c.decode(String.self, forKey: .serviceItemName)
        date = try c.decode(String.self, forKey: .date)
        durationMinutes = try c.decode(Int.self, forKey: .durationMinutes)
        locationType = (try? c.decode(String.self, forKey: .locationType)) ?? "office"
        locationName = try? c.decode(String.self, forKey: .locationName)
        notes = try? c.decode(String.self, forKey: .notes)
        isBillable = (try? c.decode(Bool.self, forKey: .isBillable)) ?? true
        isInvoiced = try? c.decode(Bool.self, forKey: .isInvoiced)
        isHeld = try? c.decode(Bool.self, forKey: .isHeld)
        status = (try? c.decode(String.self, forKey: .status)) ?? ((isInvoiced ?? false) ? "exported" : "draft")
        flagged = try? c.decode(Bool.self, forKey: .flagged)
        flagReason = try? c.decode(String.self, forKey: .flagReason)
        flagHistory = try? c.decode([FlagNote].self, forKey: .flagHistory)
    }

    var statusValue: EntryStatus { EntryStatus(rawValue: status) ?? .draft }
    var location: LocationKind { LocationKind(rawValue: locationType) ?? .office }
    var isFlagged: Bool { flagged ?? false }
    var isLocked: Bool { status == "approved" || status == "exported" }

    /// "Acme Corp · Phase 1", or a friendly fallback.
    var title: String {
        let c = (customerName ?? "").trimmingCharacters(in: .whitespaces)
        let j = (jobName ?? "").trimmingCharacters(in: .whitespaces)
        if c.isEmpty && j.isEmpty { return "No customer" }
        return j.isEmpty ? c : (c.isEmpty ? j : "\(c) · \(j)")
    }
    var subtitle: String {
        let t = (serviceItemName ?? "").trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? "No task" : t
    }
}

struct TimerState: Codable, Hashable {
    var userId: String
    var customerId: String?
    var jobId: String?
    var serviceItemId: String?
    var locationType: String
    var startTime: Double          // ms since epoch (server clock)
    var elapsedBeforePause: Int    // seconds
    var isRunning: Bool
    var notes: String?
    var serverNow: Double?
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
