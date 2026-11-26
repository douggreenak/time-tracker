import SwiftUI
import Observation

/// An entry being created or edited in the editor sheet.
struct EntryDraft: Identifiable, Equatable {
    var id: String?                 // nil = new
    var userId: String
    var date: Date = Date()
    var hours: Int = 1
    var minutes: Int = 0            // always a multiple of 6 (tenths of an hour, like the workbook)
    var customerId: String = ""
    var notes: String = ""
    var billable: Bool = true
    var held: Bool = false
    var lumpSum: Bool = false
    var partsNote: String = ""
    var internalNote: String = ""
    var contractPo: String = ""

    var draftID: String { id ?? "new" }
    var totalMinutes: Int { hours * 60 + minutes }

    init(userId: String) { self.userId = userId }

    init(_ e: TimeEntry) {
        id = e.id
        userId = e.userId
        date = Fmt.date(e.date)
        hours = e.durationMinutes / 60
        minutes = Fmt.snapToTenth(e.durationMinutes % 60)
        customerId = e.customerId ?? ""
        notes = e.notes ?? ""
        billable = e.isBillable
        held = e.isHeld
        lumpSum = e.isLumpSum
        partsNote = e.partsNote ?? ""
        internalNote = e.internalNote ?? ""
        contractPo = e.contractPo ?? ""
    }
}

@MainActor
@Observable
final class AppState {
    enum Phase { case launching, signedOut, signedIn, offline(String) }

    var phase: Phase = .launching
    var me: AppUser?
    /// Set by any screen that wants to jump to another tab (MainTabs reads and clears it).
    var requestedTab: Int?

    var customers: [Customer] = []
    var users: [AppUser] = []
    var entries: [TimeEntry] = []
    var timer: LocalTimer?

    var loadingEntries = false
    var toast: String?
    /// Set when the last sync couldn't reach or understand the server. The app shows it as a banner until a sync works.
    var syncError: String?
    var lastSynced: Date?

    private let api = APIClient.shared

    var isManager: Bool { me?.isManager ?? false }
    var myEntries: [TimeEntry] { entries.filter { $0.userId == me?.id } }

    // MARK: Session

    func bootstrap() async {
        phase = .launching
        do {
            if let user: AppUser = try await api.getOptional("api/auth/me") {
                me = user
                phase = .signedIn
                loadTimerFromDisk()
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
        loadTimerFromDisk()
        await refresh()
    }

    func signOut() async {
        _ = try? await api.send("POST", "api/auth/logout", as: Empty.self)
        api.clearSession()
        me = nil
        entries = []; customers = []; users = []; timer = nil
        syncError = nil; lastSynced = nil
        phase = .signedOut
    }

    // MARK: Loading

    private var lastRefresh = Date.distantPast

    /// Reloads everything. Skipped when data is under `minAge` seconds old (so quick app switches don't wake the radio).
    /// Any failure is recorded in `syncError` so the screens can tell the person instead of quietly showing old or empty lists.
    func refresh(minAge: TimeInterval = 0) async {
        guard me != nil, Date().timeIntervalSince(lastRefresh) >= minAge else { return }
        lastRefresh = Date()
        loadingEntries = true
        defer { loadingEntries = false }
        let cutoff = Calendar.current.date(byAdding: .day, value: -120, to: Date()) ?? Date()
        async let c = result { () -> [Customer] in try await self.api.get("api/customers") }
        async let u = result { () -> [AppUser] in try await self.api.get("api/users") }
        async let e = result { () -> [TimeEntry] in try await self.api.get("api/time-entries", query: ["startDate": Fmt.string(cutoff)]) }
        let (cs, us, es) = await (c, u, e)

        var failure: Error?
        func take<T>(_ r: Result<T, Error>, _ apply: (T) -> Void) {
            switch r {
            case .success(let v): apply(v)
            case .failure(let err): if failure == nil { failure = err }
            }
        }
        take(cs) { customers = $0 }
        take(us) { users = $0 }
        take(es) { entries = $0 }

        if let failure {
            lastRefresh = .distantPast   // try again next time instead of waiting out the throttle
            if case APIError.unauthorized = failure { await handle(failure) } else { syncError = failure.localizedDescription }
        } else {
            syncError = nil
            lastSynced = Date()
        }
    }

    private func result<T>(_ work: @escaping () async throws -> T) async -> Result<T, Error> {
        do { return .success(try await work()) } catch { return .failure(error) }
    }

    func reloadEntries() async { await refresh() }

    /// A 401 mid-session (cookie expired) sends the person back to sign-in.
    func handle(_ error: Error) async {
        if case APIError.unauthorized = error {
            me = nil
            phase = .signedOut
        }
    }

    // MARK: Entries

    private func fields(_ d: EntryDraft) -> [String: Any] {
        [
            "date": Fmt.string(d.date),
            "durationMinutes": d.totalMinutes,
            "customerId": d.customerId,
            "notes": d.notes,
            "isBillable": d.billable,
            "isHeld": d.held,
            "isLumpSum": d.lumpSum,
            "partsNote": d.partsNote,
            "internalNote": d.internalNote,
            "contractPo": d.contractPo,
        ]
    }

    func save(_ d: EntryDraft) async throws {
        var body = fields(d)
        if let id = d.id {
            let updated: TimeEntry? = try await api.send("PUT", "api/time-entries/\(id)", body: body)
            if let updated, let i = entries.firstIndex(where: { $0.id == id }) { entries[i] = updated }
        } else {
            body["userId"] = d.userId
            if d.customerId.isEmpty { body.removeValue(forKey: "customerId") }
            let created: TimeEntry? = try await api.send("POST", "api/time-entries", body: body)
            if let created { entries.insert(created, at: 0) }
        }
    }

    func delete(_ e: TimeEntry) async throws {
        _ = try await api.send("DELETE", "api/time-entries/\(e.id)", as: Empty.self)
        entries.removeAll { $0.id == e.id }
    }

    /// Billing changes (hold / release, mark invoiced / not invoiced). Returns how many succeeded.
    @discardableResult
    func update(_ ids: [String], _ patch: [String: Any]) async -> Int {
        var ok = 0
        var firstError: Error?
        for id in ids {
            do {
                if let e: TimeEntry = try await api.send("PUT", "api/time-entries/\(id)", body: patch),
                   let i = entries.firstIndex(where: { $0.id == e.id }) { entries[i] = e; ok += 1 }
            } catch { if firstError == nil { firstError = error } }
        }
        if let firstError {
            await handle(firstError)
            toast = ok == 0 ? firstError.localizedDescription : "Only \(ok) of \(ids.count) were saved"
        }
        return ok
    }

    func setInvoiced(_ ids: [String], _ invoiced: Bool) async -> Int { await update(ids, ["isInvoiced": invoiced]) }
    func setHeld(_ ids: [String], _ held: Bool) async -> Int { await update(ids, ["isHeld": held]) }

    // MARK: Timer (kept on this device)

    private var timerKey: String { "localTimer.\(me?.id ?? "")" }

    private func loadTimerFromDisk() {
        guard me != nil, let data = UserDefaults.standard.data(forKey: timerKey),
              let t = try? JSONDecoder().decode(LocalTimer.self, from: data), t.userId == me?.id else { timer = nil; return }
        timer = t
    }

    private func setTimer(_ t: LocalTimer?) {
        timer = t
        if let t, let data = try? JSONEncoder().encode(t) { UserDefaults.standard.set(data, forKey: timerKey) }
        else { UserDefaults.standard.removeObject(forKey: timerKey) }
    }

    func elapsedSeconds(at date: Date = Date()) -> Int {
        guard let t = timer else { return 0 }
        guard t.isRunning else { return t.elapsedBeforePause }
        return t.elapsedBeforePause + max(0, Int(date.timeIntervalSince(t.startedAt)))
    }

    func startTimer(customerId: String, notes: String) {
        setTimer(LocalTimer(userId: me?.id ?? "", customerId: customerId, notes: notes, startedAt: Date(), elapsedBeforePause: 0, isRunning: true))
    }

    func updateTimer(customerId: String, notes: String) {
        guard var t = timer else { return }
        t.customerId = customerId; t.notes = notes
        setTimer(t)
    }

    func pauseTimer() {
        guard var t = timer, t.isRunning else { return }
        t.elapsedBeforePause = elapsedSeconds()
        t.isRunning = false
        setTimer(t)
    }

    func resumeTimer() {
        guard var t = timer, !t.isRunning else { return }
        t.startedAt = Date(); t.isRunning = true
        setTimer(t)
    }

    func discardTimer() { setTimer(nil) }

    /// Stops the timer and saves it to the timesheet (rounded to the nearest tenth of an hour, at least 0.1).
    /// If the server can't be reached the timer is kept, so the time isn't lost.
    func stopTimer() async throws -> TimeEntry? {
        guard let t = timer, let me else { return nil }
        let secs = elapsedSeconds()
        let minutes = max(6, Int((Double(secs) / 360).rounded()) * 6)
        var body: [String: Any] = [
            "userId": me.id, "date": Fmt.today, "durationMinutes": minutes,
            "notes": t.notes, "isBillable": true,
        ]
        if !t.customerId.isEmpty { body["customerId"] = t.customerId }
        let created: TimeEntry? = try await api.send("POST", "api/time-entries", body: body)
        setTimer(nil)
        if let created { entries.insert(created, at: 0) }
        return created
    }

    // MARK: Customers

    @discardableResult
    func addCustomer(_ name: String) async throws -> String? {
        let c: Customer? = try await api.send("POST", "api/customers", body: ["name": name])
        if let c {
            if !customers.contains(where: { $0.id == c.id }) { customers.append(c) }
            customers.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
        return c?.id
    }

    func setCustomerActive(_ c: Customer, _ active: Bool) async throws {
        if let u: Customer = try await api.send("PUT", "api/customers/\(c.id)", body: ["isActive": active]),
           let i = customers.firstIndex(where: { $0.id == u.id }) { customers[i] = u }
    }

    func changePassword(current: String, new: String) async throws {
        _ = try await api.send("POST", "api/auth/password", body: ["currentPassword": current, "newPassword": new], as: Empty.self)
    }

    // MARK: Lookups

    func customer(_ id: String?) -> Customer? { customers.first { $0.id == id } }
    var activeCustomers: [Customer] { customers.filter(\.isActive) }
}
