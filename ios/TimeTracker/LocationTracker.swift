import SwiftUI
import CoreLocation
import Observation

// MARK: - Model

/// One recorded position. Kept on this device until it has been uploaded to the server.
struct Fix: Codable, Hashable {
    var t: TimeInterval
    var lat: Double
    var lon: Double
    var acc: Double
    var location: CLLocation { CLLocation(latitude: lat, longitude: lon) }
}

struct PlaceName: Codable, Hashable {
    var title: String
    var subtitle: String
}

/// A period of time spent in one spot.
struct Stay: Identifiable, Hashable {
    var start: Date
    var end: Date
    var lat: Double
    var lon: Double
    var isHome = false
    var id: String { "\(Int(start.timeIntervalSince1970))" }
    var minutes: Int { max(0, Int(end.timeIntervalSince(start) / 60)) }
    var key: String { LocationTracker.key(lat, lon) }
    var location: CLLocation { CLLocation(latitude: lat, longitude: lon) }
}

struct Trip: Identifiable, Hashable {
    var start: Date
    var end: Date
    var meters: Double
    var id: String { "trip-\(Int(start.timeIntervalSince1970))" }
    var minutes: Int { max(1, Int(end.timeIntervalSince(start) / 60)) }
}

enum TimelineItem: Identifiable, Hashable {
    case stay(Stay)
    case trip(Trip)
    var id: String { switch self { case .stay(let s): s.id; case .trip(let t): t.id } }
}

struct DayTimeline: Identifiable {
    var day: Date
    var items: [TimelineItem]
    var id: Date { day }
    var placeMinutes: Int { items.reduce(0) { if case .stay(let s) = $1 { $0 + s.minutes } else { $0 } } }
}

struct WorkSuggestion: Identifiable, Hashable {
    var stay: Stay
    var id: String { stay.id }
    /// Rounded to the nearest quarter hour, at least 15 minutes.
    var minutes: Int { max(15, Int((Double(stay.minutes) / 15).rounded()) * 15) }
}

// MARK: - Tracker

/// Opt-in location history.
///
/// Power: uses the system's "hundred meter" accuracy tier with a 75 m distance filter and automatic pausing, so the GPS
/// is not running while you are stationary. At most one point is kept per minute. Points are uploaded to the server
/// (so they survive a lost phone and show on the web); the on-device copy is only a cache and queue, pruned after 30 days.
@Observable @MainActor
final class LocationTracker: NSObject, CLLocationManagerDelegate {
    private(set) var enabled: Bool
    private(set) var status: CLAuthorizationStatus
    private(set) var fixes: [Fix] = []
    private(set) var names: [String: PlaceName] = [:]
    private(set) var dismissed: Set<String> = []

    private let manager = CLLocationManager()
    private var lastKept: TimeInterval = 0
    private var unsaved = 0
    private var geocoding = false
    private var syncing = false
    /// Newest fix (epoch seconds) the server has confirmed.
    private(set) var syncedUpTo: TimeInterval = UserDefaults.standard.double(forKey: "locSyncedT")
    private var namesSynced: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "locNamesSynced") ?? [])
    private(set) var lastSyncFailed = false
    private let geocoder = CLGeocoder()
    private static let retentionDays = 30
    private static let minStay = 10          // minutes shown on the timeline
    private static let minWorkStay = 20      // minutes before we suggest logging it

    override init() {
        let d = UserDefaults.standard
        enabled = d.bool(forKey: "locTracking")
        status = CLLocationManager().authorizationStatus
        super.init()
        manager.delegate = self
        fixes = Self.load()
        names = (d.data(forKey: "locNames").flatMap { try? JSONDecoder().decode([String: PlaceName].self, from: $0) }) ?? [:]
        dismissed = Set(d.stringArray(forKey: "locDismissed") ?? [])
        lastKept = fixes.last?.t ?? 0
    }

    var isAuthorized: Bool { status == .authorizedAlways || status == .authorizedWhenInUse }
    var isDenied: Bool { status == .denied || status == .restricted }
    var isRunning: Bool { enabled && isAuthorized }

    // MARK: Control

    func enable() {
        enabled = true
        UserDefaults.standard.set(true, forKey: "locTracking")
        if status == .notDetermined { manager.requestWhenInUseAuthorization() } else { startUpdates() }
    }

    func disable() {
        enabled = false
        UserDefaults.standard.set(false, forKey: "locTracking")
        manager.stopUpdatingLocation()
        flush()
    }

    /// Stops tracking and wipes everything stored on this device.
    func eraseHistory() {
        fixes = []; lastKept = 0; unsaved = 0
        dismissed = []; names = [:]
        syncedUpTo = 0; namesSynced = []
        UserDefaults.standard.removeObject(forKey: "locSyncedT")
        UserDefaults.standard.removeObject(forKey: "locNamesSynced")
        UserDefaults.standard.removeObject(forKey: "locNames")
        UserDefaults.standard.removeObject(forKey: "locDismissed")
        try? FileManager.default.removeItem(at: Self.fileURL)
    }

    /// Call at launch and whenever the app returns to the foreground.
    func resumeIfNeeded() {
        status = manager.authorizationStatus
        if enabled, isAuthorized { startUpdates() }
    }

    private func startUpdates() {
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 75
        manager.activityType = .other
        manager.pausesLocationUpdatesAutomatically = true
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true   // the blue pill by the clock
        manager.startUpdatingLocation()
        if status == .authorizedWhenInUse { manager.requestAlwaysAuthorization() }
    }

    // MARK: Delegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let s = manager.authorizationStatus
        Task { @MainActor in
            self.status = s
            if self.enabled, self.isAuthorized { self.startUpdates() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let incoming = locations.filter { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 200 }
            .map { Fix(t: $0.timestamp.timeIntervalSince1970, lat: $0.coordinate.latitude, lon: $0.coordinate.longitude, acc: $0.horizontalAccuracy) }
        guard !incoming.isEmpty else { return }
        Task { @MainActor in
            for f in incoming where f.t - self.lastKept >= 60 {
                self.fixes.append(f); self.lastKept = f.t; self.unsaved += 1
            }
            if self.unsaved >= 10 { self.flush(); Task { await self.syncNow() } }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    // MARK: Persistence

    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("location-history.json")
    }

    private static func load() -> [Fix] {
        guard let data = try? Data(contentsOf: fileURL), let all = try? JSONDecoder().decode([Fix].self, from: data) else { return [] }
        let cutoff = Date().addingTimeInterval(-Double(retentionDays) * 86400).timeIntervalSince1970
        return all.filter { $0.t >= cutoff }
    }

    func flush() {
        guard unsaved > 0 || !fixes.isEmpty else { return }
        unsaved = 0
        let cutoff = Date().addingTimeInterval(-Double(Self.retentionDays) * 86400).timeIntervalSince1970
        fixes.removeAll { $0.t < cutoff }
        var url = Self.fileURL
        if let data = try? JSONEncoder().encode(fixes) {
            try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var v = URLResourceValues(); v.isExcludedFromBackup = true
            try? url.setResourceValues(v)
        }
    }

    // MARK: Upload

    /// Sends everything not yet confirmed by the server. Safe to call often: repeats are ignored on both ends.
    func syncNow() async {
        guard !syncing else { return }
        syncing = true
        defer { syncing = false }
        flush()
        do {
            var pending = fixes.filter { $0.t > syncedUpTo }
            while !pending.isEmpty {
                let batch = Array(pending.prefix(2000))
                let body: [String: Any] = ["points": batch.map { ["t": Int($0.t * 1000), "lat": $0.lat, "lon": $0.lon, "acc": $0.acc] as [String: Any] }]
                _ = try await APIClient.shared.send("POST", "api/locations/points", body: body, as: Empty.self)
                syncedUpTo = batch.last!.t
                UserDefaults.standard.set(syncedUpTo, forKey: "locSyncedT")
                pending.removeFirst(batch.count)
            }
            let fresh = names.filter { !namesSynced.contains($0.key) }
            if !fresh.isEmpty {
                let body: [String: Any] = ["auto": true, "places": fresh.map { ["key": $0.key, "name": $0.value.title, "subtitle": $0.value.subtitle] }]
                _ = try await APIClient.shared.send("PUT", "api/locations/places", body: body, as: Empty.self)
                namesSynced.formUnion(fresh.keys)
                UserDefaults.standard.set(Array(namesSynced), forKey: "locNamesSynced")
            }
            lastSyncFailed = false
        } catch {
            lastSyncFailed = true   // stays queued on the phone; tried again next time
        }
    }

    func dismiss(_ s: WorkSuggestion) {
        dismissed.insert(s.id)
        UserDefaults.standard.set(Array(dismissed), forKey: "locDismissed")
    }

    // MARK: Analysis

    nonisolated static func key(_ lat: Double, _ lon: Double) -> String { String(format: "%.3f,%.3f", lat, lon) }

    func stays(now: Date = Date()) -> [Stay] {
        let gap: TimeInterval = 14 * 3600   // updates pause while you are still, so long gaps at one spot are normal
        let radius: CLLocationDistance = 150
        var out: [Stay] = []
        var i = 0
        while i < fixes.count {
            let a = fixes[i]
            let anchor = a.location
            var j = i
            var sumLat = a.lat, sumLon = a.lon, n = 1.0
            while j + 1 < fixes.count {
                let b = fixes[j + 1]
                if b.t - fixes[j].t > gap { break }
                if b.location.distance(from: anchor) > radius { break }
                j += 1; sumLat += b.lat; sumLon += b.lon; n += 1
            }
            var endT = fixes[j].t
            if j + 1 < fixes.count, fixes[j + 1].t - endT <= gap {
                endT = fixes[j + 1].t                      // left when the next point arrived
            } else if j == fixes.count - 1, enabled {
                endT = min(now.timeIntervalSince1970, endT + 12 * 3600)  // still here
            }
            let s = Stay(start: Date(timeIntervalSince1970: a.t), end: Date(timeIntervalSince1970: endT), lat: sumLat / n, lon: sumLon / n)
            if s.minutes >= Self.minStay { out.append(s) }
            i = j + 1
        }
        // Home = where the nights are spent.
        let cal = Calendar.current
        var homes: [CLLocation] = []
        for s in out {
            var night: TimeInterval = 0
            var day = cal.startOfDay(for: s.start)
            while day < s.end {
                let w0 = day, w1 = cal.date(byAdding: .hour, value: 5, to: day)!
                night += max(0, min(s.end, w1).timeIntervalSince(max(s.start, w0)))
                day = cal.date(byAdding: .day, value: 1, to: day)!
            }
            if night >= 3600, !homes.contains(where: { $0.distance(from: s.location) < 200 }) { homes.append(s.location) }
        }
        return out.map { s in
            var s = s
            s.isHome = homes.contains { $0.distance(from: s.location) < 200 }
            return s
        }
    }

    func timeline(now: Date = Date()) -> [DayTimeline] {
        let cal = Calendar.current
        let all = stays(now: now)
        var byDay: [Date: [TimelineItem]] = [:]
        for (idx, s) in all.enumerated() {
            let day = cal.startOfDay(for: s.start)
            byDay[day, default: []].append(.stay(s))
            if idx + 1 < all.count {
                let nx = all[idx + 1]
                let gapT = nx.start.timeIntervalSince(s.end)
                if gapT >= 120, gapT <= 4 * 3600, cal.isDate(nx.start, inSameDayAs: s.start) {
                    let pts = fixes.filter { $0.t >= s.end.timeIntervalSince1970 - 60 && $0.t <= nx.start.timeIntervalSince1970 + 60 }
                    var meters = 0.0
                    for k in pts.indices.dropFirst() { meters += pts[k].location.distance(from: pts[k - 1].location) }
                    if meters < 300 { meters = s.location.distance(from: nx.location) }
                    byDay[day, default: []].append(.trip(Trip(start: s.end, end: nx.start, meters: meters)))
                }
            }
        }
        return byDay.map { DayTimeline(day: $0.key, items: $0.value) }.sorted { $0.day > $1.day }
    }

    /// Stays worth logging: recent, not at home, long enough, and not already covered by time the user entered.
    func suggestions(entries: [TimeEntry], now: Date = Date()) -> [WorkSuggestion] {
        let cal = Calendar.current
        guard let cutoff = cal.date(byAdding: .day, value: -7, to: cal.startOfDay(for: now)) else { return [] }
        let candidates = stays(now: now).filter { !$0.isHome && $0.minutes >= Self.minWorkStay && $0.start >= cutoff && !dismissed.contains($0.id) }
        var logged: [String: Int] = [:]
        for e in entries { logged[e.date, default: 0] += e.durationMinutes }
        var covered: [String: Int] = [:]
        var result: [WorkSuggestion] = []
        for s in candidates.sorted(by: { $0.start < $1.start }) {
            let day = Fmt.string(s.start)
            let sug = WorkSuggestion(stay: s)
            covered[day, default: 0] += sug.minutes
            if covered[day]! > (logged[day] ?? 0) { result.append(sug) }
        }
        return result.sorted { $0.stay.start > $1.stay.start }
    }

    // MARK: Place names

    func name(for s: Stay) -> PlaceName? { names[s.key] }

    func resolveNames(for list: [Stay]) {
        guard !geocoding else { return }
        guard let next = list.first(where: { names[$0.key] == nil }) else { return }
        geocoding = true
        let key = next.key
        geocoder.reverseGeocodeLocation(next.location) { [weak self] marks, _ in
            let m = marks?.first
            let title = m?.areasOfInterest?.first
                ?? [m?.subThoroughfare, m?.thoroughfare].compactMap { $0 }.joined(separator: " ").nilIfEmpty
                ?? m?.name ?? "Unnamed place"
            let sub = [m?.locality, m?.administrativeArea].compactMap { $0 }.joined(separator: ", ")
            Task { @MainActor in
                guard let self else { return }
                self.names[key] = PlaceName(title: title, subtitle: sub)
                if let data = try? JSONEncoder().encode(self.names) { UserDefaults.standard.set(data, forKey: "locNames") }
                Task { await self.syncNow() }
                try? await Task.sleep(for: .seconds(1.2))      // be polite to the geocoder
                self.geocoding = false
                self.resolveNames(for: list)
            }
        }
    }

    #if DEBUG
    /// Fills in three days of believable movement for screenshots: home, a client site, a lunch stop, a second site.
    func seedDemo() {
        let cal = Calendar.current
        var out: [Fix] = []
        func add(_ day: Int, _ h: Int, _ m: Int, _ lat: Double, _ lon: Double) {
            let d = cal.date(byAdding: .day, value: -day, to: cal.startOfDay(for: Date()))!
            let t = cal.date(bySettingHour: h, minute: m, second: 0, of: d)!
            out.append(Fix(t: t.timeIntervalSince1970, lat: lat, lon: lon, acc: 20))
        }
        let home = (61.2181, -149.9003), siteA = (61.2160, -149.8650), lunch = (61.2190, -149.8700), siteB = (61.1960, -149.8430)
        for day in [1, 0] {
            add(day, 0, 5, home.0, home.1); add(day, 6, 30, home.0, home.1)
            for k in 1...3 { add(day, 7, 40 + k * 4, home.0 + (siteA.0 - home.0) * Double(k) / 4, home.1 + (siteA.1 - home.1) * Double(k) / 4) }
            add(day, 8, 5, siteA.0, siteA.1); add(day, 10, 30, siteA.0, siteA.1); add(day, 11, 52, siteA.0, siteA.1)
            add(day, 12, 4, lunch.0, lunch.1); add(day, 12, 40, lunch.0, lunch.1)
            add(day, 13, 5, siteB.0, siteB.1); add(day, 15, 20, siteB.0, siteB.1)
            if day > 0 { add(day, 16, 20, siteB.0, siteB.1); add(day, 17, 5, home.0, home.1); add(day, 23, 30, home.0, home.1) }
        }
        fixes = out.sorted { $0.t < $1.t }
        syncedUpTo = 0; namesSynced = []   // demo data always uploads afresh
        names = [
            Self.key(home.0, home.1): PlaceName(title: "Home", subtitle: "Anchorage, AK"),
            Self.key(siteA.0, siteA.1): PlaceName(title: "Substation 4 Upgrade", subtitle: "E Tudor Rd, Anchorage, AK"),
            Self.key(lunch.0, lunch.1): PlaceName(title: "Kaladi Brothers Coffee", subtitle: "Anchorage, AK"),
            Self.key(siteB.0, siteB.1): PlaceName(title: "Pumping Station B", subtitle: "Dowling Rd, Anchorage, AK"),
        ]
    }
    #endif
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
