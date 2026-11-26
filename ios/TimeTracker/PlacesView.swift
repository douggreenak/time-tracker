import SwiftUI
import MapKit
import CoreLocation
import UniformTypeIdentifiers
import Compression

// MARK: - Server data (the web app's /api/locations)

struct PlaceStay: Decodable, Identifiable, Hashable {
    var id: String
    var start: Double
    var end: Double
    var minutes: Int
    var lat: Double
    var lon: Double
    var isHome: Bool
    var src: String
    var name: String?
    var subtitle: String
    var key: String
    var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
    var coordinate: CLLocationCoordinate2D { .init(latitude: lat, longitude: lon) }
}

struct PlaceTrip: Decodable, Identifiable, Hashable {
    var id: String
    var minutes: Int
    var meters: Double
    var activity: String?
}

enum PlaceItem: Decodable, Identifiable, Hashable {
    case stay(PlaceStay)
    case trip(PlaceTrip)
    var id: String { switch self { case .stay(let s): s.id; case .trip(let t): t.id } }
    private enum K: String, CodingKey { case kind }
    init(from decoder: Decoder) throws {
        let kind = try decoder.container(keyedBy: K.self).decode(String.self, forKey: .kind)
        self = kind == "trip" ? .trip(try PlaceTrip(from: decoder)) : .stay(try PlaceStay(from: decoder))
    }
}

struct PlaceDay: Decodable, Identifiable, Hashable {
    var date: String
    var items: [PlaceItem]
    var placeMinutes: Int
    var id: String { date }
}

struct PlaceSuggestion: Decodable, Identifiable, Hashable {
    var id: String
    var date: String
    var start: Double
    var end: Double
    var minutes: Int
    var lat: Double
    var lon: Double
    var name: String?
    var subtitle: String
    var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
}

private struct PlacesPayload: Decodable {
    struct Counts: Decodable { var points: Int; var visits: Int }
    var days: [PlaceDay]
    var suggestions: [PlaceSuggestion]
    var counts: Counts
}
private struct TrackPayload: Decodable { var points: [[Double]] }
private struct ImportResult: Decodable { var visits: Int; var trips: Int; var skipped: Int }

/// Timeline, proposed time entries and map data, all stored on (and computed by) the server so the web app shows the same.
@Observable @MainActor
final class PlacesModel {
    private(set) var days: [PlaceDay] = []
    private(set) var suggestions: [PlaceSuggestion] = []
    private(set) var hasHistory = false
    private(set) var loading = false
    private(set) var loaded = false
    var error: String?
    var importMessage: String?

    private let api = APIClient.shared
    private var tz: String { TimeZone.current.identifier }

    func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        let to = Fmt.string(Date())
        let from = Fmt.string(Calendar.current.date(byAdding: .day, value: -59, to: Date()) ?? Date())
        do {
            let p: PlacesPayload = try await api.get("api/locations", query: ["from": from, "to": to, "tz": tz, "suggest": "14"])
            days = p.days; suggestions = p.suggestions; hasHistory = p.counts.points + p.counts.visits > 0
            error = nil; loaded = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    func track(for day: String) async -> [CLLocationCoordinate2D] {
        guard let p: TrackPayload = try? await api.get("api/locations/track", query: ["from": day, "to": day, "tz": tz]) else { return [] }
        return p.points.compactMap { $0.count == 3 ? CLLocationCoordinate2D(latitude: $0[1], longitude: $0[2]) : nil }
    }

    func dismiss(_ s: PlaceSuggestion) async {
        suggestions.removeAll { $0.id == s.id }
        _ = try? await api.send("POST", "api/locations/dismiss", body: ["stayId": s.id], as: Empty.self)
    }

    func rename(_ s: PlaceStay, to name: String) async {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { return }
        _ = try? await api.send("PUT", "api/locations/places", body: ["places": [["key": s.key, "name": n, "subtitle": s.subtitle]]], as: Empty.self)
        await load()
    }

    /// Deletes this person's location history on the server (the phone's own queue is cleared by the caller).
    func eraseAll() async {
        _ = try? await api.send("DELETE", "api/locations?src=all", as: Empty.self)
        await load()
    }

    func reset() { days = []; suggestions = []; hasHistory = false; loaded = false; error = nil }

    // MARK: Arc import

    /// Reads an Arc Timeline export (.json or .json.gz) and sends its items to the server in pieces.
    func importArc(from url: URL) async {
        importMessage = "Reading file…"
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            var data = try Data(contentsOf: url)
            if data.count > 2, data[0] == 0x1f, data[1] == 0x8b {
                guard let raw = Self.gunzip(data) else { importMessage = "That compressed file couldn't be opened."; return }
                data = raw
            } else if data.count > 2, data[0] == 0x50, data[1] == 0x4b {
                importMessage = "That is a .zip. Unzip it in Files first, then choose the .json or .json.gz inside."; return
            }
            let obj = try JSONSerialization.jsonObject(with: data)
            let items = ((obj as? [String: Any])?["timelineItems"] as? [Any]) ?? (obj as? [Any]) ?? []
            guard !items.isEmpty else { importMessage = "No Arc timeline items were found in that file."; return }
            var visits = 0, trips = 0, skipped = 0, sent = 0
            var i = 0
            while i < items.count {
                let chunk = Array(items[i..<min(i + 200, items.count)])
                let r: ImportResult? = try await api.send("POST", "api/locations/import", body: ["items": chunk], as: ImportResult.self)
                visits += r?.visits ?? 0; trips += r?.trips ?? 0; skipped += r?.skipped ?? 0
                i += chunk.count; sent = i
                importMessage = "Imported \(sent) of \(items.count) items…"
            }
            importMessage = "Done: \(visits) new places and \(trips) trips added\(skipped > 0 ? " (\(skipped) items had no usable time or position)" : "")."
            await load()
        } catch {
            importMessage = "That file couldn't be imported: \(error.localizedDescription)"
        }
    }

    /// gzip = 10-byte header + raw deflate + 8-byte trailer; Compression's zlib mode reads the raw deflate part.
    private static func gunzip(_ d: Data) -> Data? {
        let b = [UInt8](d)
        guard b.count > 18 else { return nil }
        var i = 10
        let flg = b[3]
        if flg & 4 != 0 { guard i + 2 <= b.count else { return nil }; i += 2 + (Int(b[i]) | Int(b[i + 1]) << 8) }
        if flg & 8 != 0 { while i < b.count, b[i] != 0 { i += 1 }; i += 1 }
        if flg & 16 != 0 { while i < b.count, b[i] != 0 { i += 1 }; i += 1 }
        if flg & 2 != 0 { i += 2 }
        guard i < b.count - 8 else { return nil }
        return try? (Data(b[i..<(b.count - 8)]) as NSData).decompressed(using: .zlib) as Data
    }
}

// MARK: - View

/// Places tab: where you've been (a full Arc Timeline replacement, stored on the server), proposed time entries, and a map.
struct PlacesView: View {
    @Environment(AppState.self) private var app
    @Environment(LocationTracker.self) private var tracker
    @Environment(PlacesModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var editing: EntryDraft?
    @State private var confirmErase = false
    @State private var importing = false
    @State private var day = Fmt.string(Date())
    @State private var track: [CLLocationCoordinate2D] = []
    @State private var selected: String?
    @State private var renaming: PlaceStay?
    @State private var newName = ""
    @State private var camera: MapCameraPosition = .automatic

    private var current: PlaceDay? { model.days.first { $0.date == day } }
    private var stays: [PlaceStay] { (current?.items ?? []).compactMap { if case .stay(let s) = $0 { s } else { nil } } }

    var body: some View {
        NavigationStack {
            List {
                if let problem = model.error {
                    ErrorBanner(text: problem).listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                }
                if !tracker.enabled && !model.hasHistory {
                    optIn.listRowBackground(Color.clear).listRowSeparator(.hidden)
                } else {
                    statusCard.listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))

                    if !model.suggestions.isEmpty {
                        Section {
                            ForEach(model.suggestions) { s in suggestionCard(s) }
                        } header: { sectionTitle("Proposed time entries", "Based on where you spent time. Nothing is logged until you add it.") }
                    }

                    Section {
                        dayBar.listRowBackground(Color.clear).listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 2, leading: 16, bottom: 4, trailing: 16))
                        if !stays.isEmpty || !track.isEmpty { map.listRowBackground(Color.clear).listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16)) }
                        if current == nil {
                            EmptyState(icon: "mappin.and.ellipse", title: "Nothing this day",
                                       message: model.hasHistory ? "No places were recorded on this day." : "Places where you spend 10 minutes or more will show up here as you move around.")
                                .listRowBackground(Color.clear).listRowSeparator(.hidden)
                        }
                        ForEach(current?.items ?? []) { item in
                            row(item)
                                .listRowBackground(Color.clear).listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 3, leading: 16, bottom: 3, trailing: 16))
                        }
                    }

                    importCard.listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 4, trailing: 16))
                    Section {
                        Button(role: .destructive) { confirmErase = true } label: {
                            Label("Delete all location history", systemImage: "trash").rowCard(padding: 14)
                        }
                        .buttonStyle(.plain).foregroundStyle(.red)
                        .listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 4, trailing: 16))
                        Text("Location history is saved to your Time Tracker account, so it's backed up and shown on the web. Only you can see it.")
                            .font(.footnote).foregroundStyle(Color.primary.opacity(0.72))
                            .listRowBackground(Color.clear).listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 24, trailing: 20))
                    }
                }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListHeaderHeight, 0)
            .listSectionSpacing(.custom(0))
            .screenBackground()
            .screenHeader("Places")
            .refreshable { await tracker.syncNow(); await model.load() }
            .sheet(item: $editing, onDismiss: { Task { await app.refresh(); await model.load() } }) { d in EntryEditor(draft: d) }
            .confirmationDialog("Delete all saved location history?", isPresented: $confirmErase, titleVisibility: .visible) {
                Button("Delete everything, including on the server", role: .destructive) {
                    Task { tracker.eraseHistory(); await model.eraseAll() }
                }
            } message: { Text("This removes your recorded places and imported Arc data from your account and the web. It can't be undone.") }
            .alert("Rename place", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
                TextField("Name", text: $newName)
                Button("Save") { if let s = renaming { Task { await model.rename(s, to: newName) } }; renaming = nil }
                Button("Cancel", role: .cancel) { renaming = nil }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json, .gzip, .zip, .data]) { result in
                if case .success(let url) = result { Task { await model.importArc(from: url) } }
            }
            .task { tracker.resumeIfNeeded(); await tracker.syncNow(); await model.load(); await loadTrack() }
            .onChange(of: day) { _, _ in selected = nil; Task { await loadTrack() } }
            .onChange(of: model.days) { _, _ in fitCamera(); Task { await loadTrack() } }
            .onChange(of: selected) { _, id in
                if let s = stays.first(where: { $0.id == id }) { withAnimation { camera = .region(.init(center: s.coordinate, span: .init(latitudeDelta: 0.01, longitudeDelta: 0.01))) } }
            }
        }
    }

    private func loadTrack() async {
        let d = day
        let pts = await model.track(for: d)
        guard d == day else { return }
        track = pts
        fitCamera()
    }

    private func fitCamera() {
        var pts = track + stays.map(\.coordinate)
        guard let f = pts.first else { return }
        pts = pts.isEmpty ? [f] : pts
        let lats = pts.map(\.latitude), lons = pts.map(\.longitude)
        let center = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lons.min()! + lons.max()!) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max(0.01, (lats.max()! - lats.min()!) * 1.4), longitudeDelta: max(0.01, (lons.max()! - lons.min()!) * 1.4))
        camera = .region(.init(center: center, span: span))
    }

    // MARK: Opt-in

    private var optIn: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "location.fill.viewfinder")
                .font(.system(size: 34)).foregroundStyle(.tint)
                .frame(width: 68, height: 68).glassEffect(.regular, in: .circle)
            Text("Where have you been?").font(.title2.weight(.bold))
            Text("Turn on location history to keep a timeline of the places you visit, see them on a map here and on the web, and get suggestions for work time you may have forgotten to log.")
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 12) {
                point("icloud", "Backed up", "History is saved to your Time Tracker account, so a lost phone doesn't lose it. Only you can see it.")
                point("battery.100percent", "Light on battery", "Checks in about once a minute while you are moving and rests while you are still.")
                point("location.fill", "Always visible", "iOS shows a blue indicator by the clock whenever tracking is active.")
                point("hand.raised", "You decide", "Turn it off or delete your history at any time.")
            }
            if tracker.isDenied {
                ErrorBanner(text: "Location access is turned off for Time Tracker. Allow it in Settings to use this.")
                Button { if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) } } label: {
                    Text("Open Settings").frame(maxWidth: .infinity).padding(.vertical, 6)
                }.buttonStyle(.glassProminent).tint(.buttonBlue).controlSize(.large)
            } else {
                Button { tracker.enable() } label: {
                    Text("Turn on location history").fontWeight(.semibold).frame(maxWidth: .infinity).padding(.vertical, 6)
                }.buttonStyle(.glassProminent).tint(.buttonBlue).controlSize(.large)
            }
            Button { importing = true } label: { Label("Import from Arc Timeline", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity) }
                .buttonStyle(.glass).controlSize(.large)
            if let m = model.importMessage { Text(m).font(.footnote).foregroundStyle(.secondary) }
        }
        .glassCard(radius: 28, padding: 20)
    }

    private func point(_ icon: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).font(.body).foregroundStyle(.tint).frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(text).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Enabled

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Circle().fill(tracker.isRunning ? .green : .orange).frame(width: 10, height: 10)
                Text(tracker.isRunning ? "Location history is on" : (tracker.isDenied ? "Location access is off" : (tracker.enabled ? "Waiting for permission" : "Recording is off")))
                    .font(.headline)
                Spacer()
                if tracker.isRunning { Button("Turn off") { tracker.disable() }.buttonStyle(.glass).controlSize(.small) }
            }
            if tracker.isDenied {
                Text("Allow location access in Settings so Time Tracker can record places.").font(.subheadline).foregroundStyle(.secondary)
                Button("Open Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) } }
                    .buttonStyle(.glassProminent).tint(.buttonBlue).controlSize(.small)
            } else if !tracker.isRunning {
                Button("Turn on") { tracker.enable() }.buttonStyle(.glassProminent).tint(.buttonBlue).controlSize(.small)
            } else {
                Text(tracker.lastSyncFailed ? "Recording. Waiting to upload — it will send when you're online." : "Recording about once a minute while you move. Saved to your account.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .glassCard(radius: 22, padding: 16)
    }

    private var importCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { importing = true } label: { Label("Import from Arc Timeline", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity) }
                .buttonStyle(.glass).controlSize(.regular)
            Text(model.importMessage ?? "In Arc: Settings → Export → Timeline (JSON), then choose the file here. Importing again never adds duplicates.")
                .font(.footnote).foregroundStyle(Color.primary.opacity(0.72))
        }
    }

    private func sectionTitle(_ t: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(t).font(.headline).foregroundStyle(Color.primary)
            Text(sub).font(.footnote).foregroundStyle(Color.primary.opacity(0.72)).textCase(nil)
        }.textCase(nil).padding(.top, 6)
    }

    private var dayBar: some View {
        let d = Fmt.date(day)
        let isToday = Calendar.current.isDateInToday(d)
        return HStack(spacing: 8) {
            Button { shift(-1) } label: { Image(systemName: "chevron.left") }.buttonStyle(.glass).buttonBorderShape(.circle)
            VStack(spacing: 2) {
                Text(Self.dayTitle(d)).font(.headline)
                if let c = current { Text("\(Fmt.duration(c.placeMinutes)) at places").font(.footnote).foregroundStyle(Color.primary.opacity(0.72)) }
            }.frame(maxWidth: .infinity)
            Button { shift(1) } label: { Image(systemName: "chevron.right") }.buttonStyle(.glass).buttonBorderShape(.circle).disabled(isToday)
        }
    }

    private func shift(_ n: Int) {
        if let d = Calendar.current.date(byAdding: .day, value: n, to: Fmt.date(day)), d <= Date() { day = Fmt.string(d) }
    }

    private var map: some View {
        Map(position: $camera) {
            if track.count > 1 { MapPolyline(coordinates: track).stroke(.blue, lineWidth: 4) }
            ForEach(Array(stays.enumerated()), id: \.element.id) { i, s in
                Annotation(s.isHome ? "Home" : (s.name ?? "Place"), coordinate: s.coordinate) {
                    Text("\(i + 1)").font(.caption.weight(.bold)).foregroundStyle(.white)
                        .frame(width: selected == s.id ? 30 : 24, height: selected == s.id ? 30 : 24)
                        .background(s.isHome ? Color.gray : Color.blue, in: Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .onTapGesture { selected = s.id }
                }
            }
        }
        .frame(height: 230)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func suggestionCard(_ s: PlaceSuggestion) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "sparkles").foregroundStyle(.tint).frame(width: 26)
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.name ?? "Place near \(s.lat.formatted(.number.precision(.fractionLength(3)))), \(s.lon.formatted(.number.precision(.fractionLength(3))))")
                        .font(.headline)
                    Text("\(Self.dayTitle(Fmt.date(s.date))) · \(Self.range(s.startDate, s.endDate))")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Text(Fmt.duration(s.minutes)).font(.headline).foregroundStyle(.primary)
            }
            HStack(spacing: 10) {
                Button { editing = draft(for: s) } label: { Text("Add to timesheet").fontWeight(.semibold).frame(maxWidth: .infinity) }
                    .buttonStyle(.glassProminent).tint(.buttonBlue)
                Button("Not work") { Task { await model.dismiss(s) } }.buttonStyle(.glass)
            }.controlSize(.regular)
        }
        .rowCard()
        .listRowBackground(Color.clear).listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
    }

    private func draft(for s: PlaceSuggestion) -> EntryDraft {
        var d = EntryDraft(userId: app.me?.id ?? "")
        d.date = Fmt.date(s.date)
        let tenths = max(6, Int((Double(s.minutes) / 6).rounded()) * 6)   // billed in tenths of an hour
        d.hours = tenths / 60; d.minutes = tenths % 60
        d.notes = "At \(s.name ?? "a location") (\(Self.range(s.startDate, s.endDate)))"
        return d
    }

    @ViewBuilder private func row(_ item: PlaceItem) -> some View {
        switch item {
        case .stay(let s):
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: s.isHome ? "house.fill" : "mappin.circle.fill")
                    .font(.title3).foregroundStyle(s.isHome ? Color.secondary : Color.accentColor).frame(width: 30)
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.isHome ? "Home" : (s.name ?? "Unnamed place")).font(.headline).lineLimit(2)
                    Text(Self.range(s.startDate, s.endDate) + ((!s.subtitle.isEmpty && !s.isHome) ? " · \(s.subtitle)" : ""))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
                Spacer(minLength: 8)
                Text(Fmt.duration(s.minutes)).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
            }
            .rowCard()
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(selected == s.id ? Color.accentColor : .clear, lineWidth: 2))
            .contentShape(Rectangle())
            .onTapGesture { selected = s.id }
            .contextMenu { Button { newName = s.name ?? ""; renaming = s } label: { Label("Rename place", systemImage: "pencil") } }
        case .trip(let t):
            HStack(spacing: 14) {
                Image(systemName: Self.icon(t.activity)).font(.subheadline).foregroundStyle(.secondary).frame(width: 30)
                Text("\(t.activity?.capitalized ?? "Travel") · \(Self.distance(t.meters)) · \(Fmt.duration(t.minutes))").font(.subheadline).foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal, 16).padding(.vertical, 4)
        }
    }

    // MARK: Formatting

    private static func icon(_ activity: String?) -> String {
        switch activity?.lowercased() {
        case "walking", "running": "figure.walk"
        case "cycling", "bicycle": "bicycle"
        case "train", "bus", "tram", "metro": "tram.fill"
        case "airplane": "airplane"
        default: "car.fill"
        }
    }

    private static func range(_ a: Date, _ b: Date) -> String {
        "\(a.formatted(date: .omitted, time: .shortened)) – \(b.formatted(date: .omitted, time: .shortened))"
    }

    private static func dayTitle(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Today" }
        if cal.isDateInYesterday(d) { return "Yesterday" }
        return d.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }

    private static func distance(_ m: Double) -> String {
        let metric = Locale.current.measurementSystem == .metric
        let v = Measurement(value: m, unit: UnitLength.meters).converted(to: metric ? .kilometers : .miles)
        return v.formatted(.measurement(width: .abbreviated, usage: .asProvided, numberFormatStyle: .number.precision(.fractionLength(0...1))))
    }
}
