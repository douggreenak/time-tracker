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

/// Places tab: a day-by-day timeline (an Arc Timeline replacement stored on the server), a map, and proposed time entries.
struct PlacesView: View {
    @Environment(AppState.self) private var app
    @Environment(LocationTracker.self) private var tracker
    @Environment(PlacesModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var editing: EntryDraft?
    @State private var day = Fmt.string(Date())
    @State private var track: [CLLocationCoordinate2D] = []
    @State private var selected: String?
    @State private var renaming: PlaceStay?
    @State private var newName = ""
    @State private var camera: MapCameraPosition = .automatic
    @State private var pickingDate = false
    @State private var showAllSuggestions = false
    @State private var suggestionsOpen = UserDefaults.standard.bool(forKey: "debugSuggestionsOpen")

    #if DEBUG
    private static let hideSuggestionsForScreenshot = UserDefaults.standard.bool(forKey: "debugHideSuggestions")
    #else
    private static let hideSuggestionsForScreenshot = false
    #endif

    /// The dense timeline parts stop growing at this text size (they would no longer fit beside the time and rail columns).
    private static let maxType = DynamicTypeSize.xxxLarge

    private var current: PlaceDay? { model.days.first { $0.date == day } }
    private var stays: [PlaceStay] { (current?.items ?? []).compactMap { if case .stay(let s) = $0 { s } else { nil } } }
    private var meters: Double { (current?.items ?? []).reduce(0) { if case .trip(let t) = $1 { $0 + t.meters } else { $0 } } }

    var body: some View {
        NavigationStack {
            List {
                if let problem = model.error {
                    ErrorBanner(text: problem).plain(top: 0, bottom: 8)
                }
                if !tracker.enabled && !model.hasHistory {
                    optIn.plain()
                } else {
                    if !tracker.isRunning { recordingBanner.plain(top: 0, bottom: 10) }
                    if !model.suggestions.isEmpty, !Self.hideSuggestionsForScreenshot { suggestionsCard.dynamicTypeSize(...Self.maxType).plain(top: 0, bottom: 12) }
                    dayBar.dynamicTypeSize(...Self.maxType).plain(top: 2, bottom: 8)
                    if !stays.isEmpty || track.count > 1 { map.plain(top: 0, bottom: 12) }
                    if let current, !current.items.isEmpty { timeline(current).dynamicTypeSize(...Self.maxType).plain(top: 0, bottom: 28) }
                    else { quietDay.plain(top: 0, bottom: 28) }
                }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListHeaderHeight, 0)
            .listSectionSpacing(.custom(0))
            .screenBackground()
            .screenHeader("Places") {
                Menu {
                    if tracker.enabled { Button { tracker.disable() } label: { Label("Pause recording", systemImage: "pause.circle") } }
                    else { Button { tracker.enable() } label: { Label("Start recording", systemImage: "record.circle") } }
                    Button { app.requestedTab = 4 } label: { Label("Import & settings", systemImage: "gearshape") }
                } label: { Label("Recording", systemImage: tracker.isRunning ? "location.fill" : "location.slash") }
            }
            .refreshable { await tracker.syncNow(); await model.load() }
            .sheet(item: $editing, onDismiss: { Task { await app.refresh(); await model.load() } }) { d in EntryEditor(draft: d) }
            .sheet(isPresented: $pickingDate) { datePicker }
            .alert("Rename place", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
                TextField("Name", text: $newName)
                Button("Save") { if let s = renaming { Task { await model.rename(s, to: newName) } }; renaming = nil }
                Button("Cancel", role: .cancel) { renaming = nil }
            }
            .task { tracker.resumeIfNeeded(); await tracker.syncNow(); await model.load(); await loadTrack() }
            .onChange(of: day) { _, _ in selected = nil; Task { await loadTrack() } }
            .onChange(of: model.days) { _, _ in fitCamera(); Task { await loadTrack() } }
            .onChange(of: selected) { _, id in
                if let s = stays.first(where: { $0.id == id }) { withAnimation { camera = .region(.init(center: s.coordinate, span: .init(latitudeDelta: 0.01, longitudeDelta: 0.01))) } }
            }
            #if DEBUG
            .onAppear { if let d = UserDefaults.standard.string(forKey: "debugDay") { day = d } }
            #endif
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
        let pts = track + stays.map(\.coordinate)
        guard !pts.isEmpty else { return }
        let lats = pts.map(\.latitude), lons = pts.map(\.longitude)
        let center = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lons.min()! + lons.max()!) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max(0.012, (lats.max()! - lats.min()!) * 1.5), longitudeDelta: max(0.012, (lons.max()! - lons.min()!) * 1.5))
        camera = .region(.init(center: center, span: span))
    }

    // MARK: Opt-in and status

    private var optIn: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "location.fill.viewfinder")
                .font(.system(size: 34)).foregroundStyle(.tint)
                .frame(width: 68, height: 68).glassEffect(.regular, in: .circle)
            Text("Where have you been?").font(.title2.weight(.bold))
            Text("Keep a timeline of the places you visit, see them on a map here and on the web, and get suggestions for work time you may have forgotten to log.")
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 12) {
                point("icloud", "Backed up", "Saved to your Time Tracker account, so a lost phone doesn't lose it. Only you can see it.")
                point("battery.100percent", "Light on battery", "Checks in about once a minute while you move and rests while you are still.")
                point("location.fill", "Always visible", "iOS shows a blue indicator by the clock whenever tracking is active.")
                point("hand.raised", "You decide", "Pause it or delete your history at any time in Account.")
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
            Text("Coming from Arc? Import your timeline in Account → Location history.")
                .font(.footnote).foregroundStyle(.secondary)
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

    /// One slim line, only when recording is not running.
    private var recordingBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: tracker.isDenied ? "location.slash.fill" : "pause.circle.fill").foregroundStyle(.orange)
            Text(tracker.isDenied ? "Location access is off" : (tracker.enabled ? "Waiting for permission" : "Recording is paused"))
                .font(.subheadline.weight(.medium))
            Spacer(minLength: 8)
            if tracker.isDenied {
                Button("Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) } }
            } else {
                Button("Resume") { tracker.enable() }
            }
        }
        .buttonStyle(.glass).controlSize(.small)
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(.ultraThinMaterial, in: Capsule())
    }

    // MARK: Proposed time

    private var suggestionsCard: some View {
        let list = model.suggestions
        let shown = showAllSuggestions ? list : Array(list.prefix(4))
        let total = list.reduce(0) { $0 + $1.minutes }
        return VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.smooth) { suggestionsOpen.toggle() } } label: {
                HStack(spacing: 10) {
                    Image(systemName: "sparkles").foregroundStyle(.tint).frame(width: 24)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(list.count) proposed time \(list.count == 1 ? "entry" : "entries")").font(.subheadline.weight(.semibold))
                        Text("About \(Fmt.duration(total)) · Review and add").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.down").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                        .rotationEffect(.degrees(suggestionsOpen ? 180 : 0))
                }
                .contentShape(Rectangle())
            }.buttonStyle(.plain)
            if suggestionsOpen {
                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { i, s in
                        Divider().padding(.vertical, 8)
                        suggestionRow(s)
                    }
                }.padding(.top, 2)
                if list.count > 4 {
                    Button(showAllSuggestions ? "Show fewer" : "Show \(list.count - 4) more") { withAnimation { showAllSuggestions.toggle() } }
                        .font(.subheadline.weight(.medium)).frame(maxWidth: .infinity).padding(.top, 10)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
    }

    private func suggestionRow(_ s: PlaceSuggestion) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(s.name ?? "Place near \(s.lat.formatted(.number.precision(.fractionLength(3)))), \(s.lon.formatted(.number.precision(.fractionLength(3))))")
                    .font(.subheadline.weight(.semibold)).lineLimit(2)
                Text("\(Self.dayTitle(Fmt.date(s.date))) · \(Self.range(s.startDate, s.endDate)) · \(Fmt.duration(s.minutes))")
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 6)
            Button("Add") { editing = draft(for: s) }.buttonStyle(.glassProminent).tint(.buttonBlue).controlSize(.small)
            Menu {
                Button(role: .destructive) { Task { await model.dismiss(s) } } label: { Label("Not work", systemImage: "xmark.circle") }
            } label: { Image(systemName: "ellipsis").frame(width: 28, height: 28).contentShape(Rectangle()) }
                .buttonStyle(.plain).foregroundStyle(.secondary).accessibilityLabel("More")
        }
    }

    private func draft(for s: PlaceSuggestion) -> EntryDraft {
        var d = EntryDraft(userId: app.me?.id ?? "")
        d.date = Fmt.date(s.date)
        let tenths = max(6, Int((Double(s.minutes) / 6).rounded()) * 6)   // billed in tenths of an hour
        d.hours = tenths / 60; d.minutes = tenths % 60
        d.notes = "At \(s.name ?? "a location") (\(Self.range(s.startDate, s.endDate)))"
        return d
    }

    // MARK: Day

    private var dayBar: some View {
        let d = Fmt.date(day)
        let isToday = Calendar.current.isDateInToday(d)
        let places = stays.filter { !$0.isHome }.count
        var bits: [String] = []
        if places > 0 { bits.append("\(places) \(places == 1 ? "place" : "places")") }
        if let c = current, c.placeMinutes > 0 { bits.append(Fmt.duration(c.placeMinutes)) }
        if meters > 100 { bits.append(Self.distance(meters)) }
        return HStack(spacing: 8) {
            Button { shift(-1) } label: { Image(systemName: "chevron.left").frame(width: 22, height: 22) }
                .buttonStyle(.glass).buttonBorderShape(.circle).accessibilityLabel("Previous day")
            Button { pickingDate = true } label: {
                VStack(spacing: 2) {
                    HStack(spacing: 4) {
                        Text(Self.dayTitle(d)).font(.headline)
                        Image(systemName: "chevron.down").font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                    }
                    Text(bits.isEmpty ? "No places" : bits.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityLabel("Choose a day")
            Button { shift(1) } label: { Image(systemName: "chevron.right").frame(width: 22, height: 22) }
                .buttonStyle(.glass).buttonBorderShape(.circle).disabled(isToday).accessibilityLabel("Next day")
        }
    }

    private func shift(_ n: Int) {
        if let d = Calendar.current.date(byAdding: .day, value: n, to: Fmt.date(day)), d <= Date() { day = Fmt.string(d) }
    }

    private var datePicker: some View {
        NavigationStack {
            DatePicker("Day", selection: Binding(get: { Fmt.date(day) }, set: { day = Fmt.string($0) }), in: ...Date(), displayedComponents: .date)
                .datePickerStyle(.graphical).padding()
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { pickingDate = false } }
                           ToolbarItem(placement: .cancellationAction) { Button("Today") { day = Fmt.string(Date()); pickingDate = false } } }
                .navigationTitle("Choose a day").navigationBarTitleDisplayMode(.inline)
        }.presentationDetents([.medium])
    }

    private var map: some View {
        Map(position: $camera) {
            if track.count > 1 { MapPolyline(coordinates: track).stroke(.blue.opacity(0.85), lineWidth: 4) }
            ForEach(Array(stays.enumerated()), id: \.element.id) { i, s in
                Annotation("", coordinate: s.coordinate, anchor: .center) {
                    Text("\(i + 1)").font(.caption2.weight(.bold)).foregroundStyle(.white).dynamicTypeSize(.large)
                        .frame(width: selected == s.id ? 30 : 24, height: selected == s.id ? 30 : 24)
                        .background(s.isHome ? Color.gray : Color.buttonBlue, in: Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                        .onTapGesture { withAnimation { selected = s.id } }
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(.white.opacity(0.15), lineWidth: 0.5))
    }

    private var quietDay: some View {
        EmptyState(icon: "mappin.slash", title: "Nothing recorded",
                   message: model.hasHistory ? "No places were recorded on this day." : "Places where you spend 10 minutes or more will show up here as you move around.")
    }

    // MARK: Timeline

    private func timeline(_ d: PlaceDay) -> some View {
        var n = 0
        let rows: [(item: PlaceItem, number: Int?)] = d.items.map { item in
            if case .stay = item { n += 1; return (item, n) }
            return (item, nil)
        }
        return VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.item.id) { i, r in
                switch r.item {
                case .stay(let s): stayRow(s, number: r.number ?? 0, first: i == 0, last: i == rows.count - 1)
                case .trip(let t): tripRow(t, first: i == 0, last: i == rows.count - 1)
                }
            }
        }
        .rowCard(radius: 24, padding: 14)
    }

    private let railWidth: CGFloat = 30

    /// The vertical line joining the places, drawn behind each row.
    private func rail(first: Bool, last: Bool) -> some View {
        VStack(spacing: 0) {
            Rectangle().fill(first ? .clear : Color.primary.opacity(0.18)).frame(width: 2).frame(height: 18)
            Rectangle().fill(last ? .clear : Color.primary.opacity(0.18)).frame(width: 2).frame(maxHeight: .infinity)
        }.frame(width: railWidth)
    }

    private func stayRow(_ s: PlaceStay, number: Int, first: Bool, last: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(s.startDate.formatted(date: .omitted, time: .shortened))
                .font(.caption.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.6)
                .frame(width: 58, alignment: .trailing).padding(.top, 5)
            ZStack(alignment: .top) {
                rail(first: first, last: last)
                Image(systemName: s.isHome ? "house.fill" : "mappin")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(s.isHome ? Color.gray : Color.buttonBlue, in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(selected == s.id ? 0.9 : 0), lineWidth: 2))
            }.frame(width: railWidth)
            VStack(alignment: .leading, spacing: 2) {
                Text(s.isHome ? "Home" : (s.name ?? "Unnamed place")).font(.subheadline.weight(.semibold)).lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                Text(detail(s)).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 4).padding(.bottom, last ? 4 : 14)
            Spacer(minLength: 4)
            Text(Fmt.duration(s.minutes)).font(.subheadline.weight(.semibold)).monospacedDigit().padding(.top, 4)
        }
        .padding(.horizontal, 4)
        .background(selected == s.id ? Color.accentColor.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .contentShape(Rectangle())
        .onTapGesture { withAnimation { selected = s.id } }
        .contextMenu { Button { newName = s.name ?? ""; renaming = s } label: { Label("Rename place", systemImage: "pencil") } }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Shows it on the map. Long-press to rename.")
    }

    private func detail(_ s: PlaceStay) -> String {
        let span = "\(s.startDate.formatted(date: .omitted, time: .shortened)) – \(s.endDate.formatted(date: .omitted, time: .shortened))"
        if s.isHome { return "Until \(s.endDate.formatted(date: .omitted, time: .shortened))" }
        if s.name == nil { return "\(span) · Touch and hold to name it" }
        return s.subtitle.isEmpty ? span : s.subtitle
    }

    private func tripRow(_ t: PlaceTrip, first: Bool, last: Bool) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Color.clear.frame(width: 58, height: 1)
            ZStack { rail(first: false, last: false)
                Image(systemName: Self.icon(t.activity)).font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary)
                    .frame(width: 22, height: 22).background(.regularMaterial, in: Circle())
            }.frame(width: railWidth)
            Text("\(Self.activityName(t.activity)) · \(Self.distance(t.meters)) · \(Fmt.duration(t.minutes))")
                .font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.85)
            Spacer(minLength: 0)
        }
        .frame(minHeight: 30).padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
    }

    // MARK: Formatting

    private static func icon(_ activity: String?) -> String {
        switch activity?.lowercased() {
        case "walking", "running", "hiking": "figure.walk"
        case "cycling", "bicycle", "biking": "bicycle"
        case "train", "bus", "tram", "metro", "transit": "tram.fill"
        case "airplane", "flying": "airplane"
        default: "car.fill"
        }
    }

    private static func activityName(_ a: String?) -> String {
        switch a?.lowercased() {
        case nil, "automotive", "car", "driving": "Drive"
        case "walking": "Walk"
        case "running": "Run"
        case "cycling", "bicycle", "biking": "Bike"
        case let x?: x.capitalized
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

private extension View {
    /// A transparent list row with the page's standard side margins.
    func plain(top: CGFloat = 4, bottom: CGFloat = 4) -> some View {
        self.listRowBackground(Color.clear).listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: top, leading: 16, bottom: bottom, trailing: 16))
    }
}
