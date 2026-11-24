import SwiftUI
import Observation

/// An entry being created or edited in the editor sheet.
struct EntryDraft: Identifiable, Equatable {
    var id: String?                 // nil = new
    var userId: String
    var date: Date = Date()
    var hours: Int = 1
    var minutes: Int = 0
    var customerId: String = ""
    var jobId: String = ""
    var serviceItemId: String = ""
    var location: LocationKind = .office
    var billable: Bool = true
    var notes: String = ""

    var draftID: String { id ?? "new" }
    var totalMinutes: Int { hours * 60 + minutes }

    init(userId: String) { self.userId = userId }

    init(_ e: TimeEntry) {
        id = e.id
        userId = e.userId
        date = Fmt.date(e.date)
        hours = e.durationMinutes / 60
        minutes = e.durationMinutes % 60
        customerId = e.customerId ?? ""
        jobId = e.jobId ?? ""
        serviceItemId = e.serviceItemId ?? ""
        location = e.location
        billable = e.isBillable
        notes = e.notes ?? ""
    }
}

@MainActor
@Observable
final class AppState {
    enum Phase { case launching, signedOut, signedIn, offline(String) }

    var phase: Phase = .launching
    var me: AppUser?

    var customers: [Customer] = []
    var services: [ServiceItem] = []
    var users: [AppUser] = []
    var entries: [TimeEntry] = []
    var timer: TimerState?
    var skew: Double = 0           // server clock minus device clock, in ms

    var loadingEntries = false
    var toast: String?

    private let api = APIClient.shared

    var isManager: Bool { me?.isManager ?? false }
    var myEntries: [TimeEntry] { entries.filter { $0.userId == me?.id } }

    // MARK: Session

    func bootstrap() async {
        do {
            if let user: AppUser = try await api.getOptional("api/auth/me") {
                me = user
                phase = .signedIn
                await refresh()
            } else {
                phase = .signedOut
            }
        } catch {
            phase = .offline(error.localizedDescription)
        }
    }

    func signIn(userId: String, password: String) async throws {
        let body: [String: Any] = ["userId": userId, "password": password]
        guard let user: AppUser = try await api.send("POST", "api/auth/login", body: body) else {
            throw APIError.message("Sign-in failed.")
        }
        me = user
        phase = .signedIn
        await refresh()
    }

    func signOut() async {
        _ = try? await api.send("POST", "api/auth/logout", as: Empty.self)
        api.clearSession()
        me = nil
        entries = []; customers = []; services = []; users = []; timer = nil
        phase = .signedOut
    }

    // MARK: Loading

    private var lastRefresh = Date.distantPast

    /// Reloads everything. Skipped when data is under `minAge` seconds old (so quick app switches don't wake the radio).
    func refresh(minAge: TimeInterval = 0) async {
        guard me != nil, Date().timeIntervalSince(lastRefresh) >= minAge else { return }
        lastRefresh = Date()
        loadingEntries = true
        defer { loadingEntries = false }
        async let c: [Customer]? = try? api.get("api/customers")
        async let s: [ServiceItem]? = try? api.get("api/service-items")
        async let u: [AppUser]? = try? api.get("api/users")
        async let e: [TimeEntry]? = loadEntries()
        async let t: Void = loadTimer()
        let (cs, ss, us, es) = await (c, s, u, e)
        if let cs { customers = cs }
        if let ss { services = ss }
        if let us { users = us }
        if let es { entries = es }
        await t
    }

    private func loadEntries() async -> [TimeEntry]? {
        let cutoff = Calendar.current.date(byAdding: .day, value: -120, to: Date()) ?? Date()
        do { return try await api.get("api/time-entries", query: ["startDate": Fmt.string(cutoff)]) }
        catch { await handle(error); return nil }
    }

    func reloadEntries() async {
        if let e = await loadEntries() { entries = e }
    }

    /// A 401 mid-session (cookie expired) sends the person back to sign-in.
    func handle(_ error: Error) async {
        if case APIError.unauthorized = error {
            me = nil
            phase = .signedOut
        }
    }

    // MARK: Entries

    func save(_ d: EntryDraft) async throws {
        var body: [String: Any] = [
            "date": Fmt.string(d.date),
            "durationMinutes": d.totalMinutes,
            "customerId": d.customerId,
            "jobId": d.jobId,
            "serviceItemId": d.serviceItemId,
            "locationType": d.location.rawValue,
            "isBillable": d.billable,
            "notes": d.notes,
        ]
        if let id = d.id {
            let updated: TimeEntry? = try await api.send("PUT", "api/time-entries/\(id)", body: body)
            if let updated, let i = entries.firstIndex(where: { $0.id == id }) { entries[i] = updated }
        } else {
            body["userId"] = d.userId
            if d.customerId.isEmpty { body.removeValue(forKey: "customerId") }
            if d.jobId.isEmpty { body.removeValue(forKey: "jobId") }
            if d.serviceItemId.isEmpty { body.removeValue(forKey: "serviceItemId") }
            let created: TimeEntry? = try await api.send("POST", "api/time-entries", body: body)
            if let created { entries.insert(created, at: 0) }
        }
    }

    func delete(_ e: TimeEntry) async throws {
        _ = try await api.send("DELETE", "api/time-entries/\(e.id)", as: Empty.self)
        entries.removeAll { $0.id == e.id }
    }

    /// Status changes (submit / approve / export / send back). Returns how many succeeded.
    @discardableResult
    func setStatus(_ ids: [String], to status: EntryStatus) async -> Int {
        var ok = 0
        await withTaskGroup(of: TimeEntry?.self) { group in
            for id in ids {
                group.addTask { [api] in
                    try? await api.send("PUT", "api/time-entries/\(id)", body: ["status": status.rawValue])
                }
            }
            for await e in group {
                if let e, let i = entries.firstIndex(where: { $0.id == e.id }) { entries[i] = e; ok += 1 }
            }
        }
        return ok
    }

    func ask(_ e: TimeEntry, question: String) async throws {
        let body: [String: Any] = ["flagged": true, "flagReason": "Accountant asks: \(question)"]
        if let u: TimeEntry = try await api.send("PUT", "api/time-entries/\(e.id)", body: body),
           let i = entries.firstIndex(where: { $0.id == e.id }) { entries[i] = u }
    }

    func withdrawQuestion(_ e: TimeEntry) async throws {
        if let u: TimeEntry = try await api.send("PUT", "api/time-entries/\(e.id)", body: ["flagged": false]),
           let i = entries.firstIndex(where: { $0.id == e.id }) { entries[i] = u }
    }

    // MARK: Timer

    var timerNow: Double { Date().timeIntervalSince1970 * 1000 + skew }

    func elapsedSeconds(at date: Date = Date()) -> Int {
        guard let t = timer else { return 0 }
        guard t.isRunning else { return t.elapsedBeforePause }
        let now = date.timeIntervalSince1970 * 1000 + skew
        return t.elapsedBeforePause + max(0, Int((now - t.startTime) / 1000))
    }

    private func adopt(_ t: TimerState?) {
        timer = t
        if let n = t?.serverNow { skew = n - Date().timeIntervalSince1970 * 1000 }
    }

    func loadTimer() async {
        if let t: TimerState = try? await api.getOptional("api/timer") { adopt(t) } else { adopt(nil) }
    }

    private func timerCall(_ action: String, extra: [String: Any] = [:]) async throws {
        var body = extra
        body["action"] = action
        adopt(try await api.send("POST", "api/timer", body: body))
    }

    func startTimer(customerId: String, jobId: String, serviceId: String, location: LocationKind, notes: String) async throws {
        try await timerCall("start", extra: [
            "customerId": customerId, "jobId": jobId, "serviceItemId": serviceId,
            "locationType": location.rawValue, "notes": notes,
        ])
    }

    func updateTimer(customerId: String, jobId: String, serviceId: String, location: LocationKind, notes: String) async {
        try? await timerCall("update", extra: [
            "customerId": customerId, "jobId": jobId, "serviceItemId": serviceId,
            "locationType": location.rawValue, "notes": notes,
        ])
    }

    func pauseTimer() async throws { try await timerCall("pause") }
    func resumeTimer() async throws { try await timerCall("resume") }

    func discardTimer() async throws {
        _ = try await api.send("POST", "api/timer", body: ["action": "discard"], as: Empty.self)
        adopt(nil)
    }

    /// Stops the timer and saves it as a draft entry. The server stamps the entry with *its* date (UTC on Vercel),
    /// which is tomorrow for an Alaska evening — so the date is corrected to the device's today here.
    func stopTimer() async throws -> TimeEntry? {
        var entry: TimeEntry? = try await api.send("POST", "api/timer", body: ["action": "stop"])
        adopt(nil)
        if var e = entry, e.date != Fmt.today {
            if let fixed: TimeEntry = try? await api.send("PUT", "api/time-entries/\(e.id)", body: ["date": Fmt.today]) { e = fixed }
            entry = e
        }
        if let e = entry { entries.insert(e, at: 0) }
        return entry
    }

    // MARK: Directory

    @discardableResult
    func addCustomer(_ name: String) async throws -> String? {
        let c: Customer? = try await api.send("POST", "api/customers", body: ["name": name, "qbName": name])
        if let c {
            customers.append(c)
            customers.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
        return c?.id
    }

    @discardableResult
    func addProject(_ name: String, to customerId: String) async throws -> String? {
        let j: Job? = try await api.send("POST", "api/customers", body: ["type": "job", "name": name, "customerId": customerId])
        if let list: [Customer] = try? await api.get("api/customers") { customers = list }
        return j?.id
    }

    @discardableResult
    func addTask(_ name: String, billable: Bool) async throws -> String? {
        let s: ServiceItem? = try await api.send("POST", "api/service-items", body: ["name": name, "qbItemName": name, "defaultBillable": billable])
        if let s { services.append(s) }
        return s?.id
    }

    func setCustomerActive(_ c: Customer, _ active: Bool) async throws {
        let _: Customer? = try await api.send("PUT", "api/customers/\(c.id)", body: ["isActive": active])
        if let list: [Customer] = try? await api.get("api/customers") { customers = list }
    }

    func setJobActive(_ j: Job, _ active: Bool) async throws {
        let _: Job? = try await api.send("PUT", "api/jobs/\(j.id)", body: ["isActive": active])
        if let list: [Customer] = try? await api.get("api/customers") { customers = list }
    }

    func changePassword(current: String, new: String) async throws {
        _ = try await api.send("POST", "api/auth/password", body: ["currentPassword": current, "newPassword": new], as: Empty.self)
    }

    // MARK: Lookups

    func customer(_ id: String?) -> Customer? { customers.first { $0.id == id } }
    var activeCustomers: [Customer] { customers.filter(\.isActive) }
    var activeServices: [ServiceItem] { services }
}
