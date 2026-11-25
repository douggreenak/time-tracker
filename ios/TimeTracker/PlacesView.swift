import SwiftUI
import CoreLocation

/// Opt-in location timeline and suggested work time.
struct PlacesView: View {
    @Environment(AppState.self) private var app
    @Environment(LocationTracker.self) private var tracker
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var editing: EntryDraft?
    @State private var confirmErase = false

    var body: some View {
        let days = tracker.enabled ? tracker.timeline() : []
        let suggestions = tracker.enabled ? tracker.suggestions(entries: app.myEntries) : []
        return NavigationStack {
            List {
                if !tracker.enabled {
                    optIn.listRowBackground(Color.clear).listRowSeparator(.hidden)
                } else {
                    statusCard.listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))

                    if !suggestions.isEmpty {
                        Section {
                            ForEach(suggestions) { s in suggestionCard(s) }
                        } header: { sectionTitle("Suggested work time", "Based on where you spent time. Nothing is logged until you add it.") }
                    }

                    if days.isEmpty {
                        EmptyState(icon: "mappin.and.ellipse", title: "Nothing yet",
                                   message: "Places where you spend 10 minutes or more will show up here as you move around.")
                            .listRowBackground(Color.clear).listRowSeparator(.hidden)
                    }
                    ForEach(days) { day in
                        Section {
                            ForEach(day.items) { item in
                                row(item)
                                    .listRowBackground(Color.clear).listRowSeparator(.hidden)
                                    .listRowInsets(EdgeInsets(top: 3, leading: 16, bottom: 3, trailing: 16))
                            }
                        } header: { dayHeader(day) }
                    }

                    Section {
                        Button(role: .destructive) { confirmErase = true } label: {
                            Label("Delete location history", systemImage: "trash")
                        }.glassRow()
                    } footer: {
                        Text("Location history stays on this iPhone, is never uploaded, and is deleted automatically after 30 days.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.plain)
            .screenBackground()
            .screenHeader("Places") {
                Button { dismiss() } label: { Label("Done", systemImage: "xmark") }
            }
            .sheet(item: $editing) { d in EntryEditor(draft: d) }
            .confirmationDialog("Delete all saved location history?", isPresented: $confirmErase, titleVisibility: .visible) {
                Button("Delete history", role: .destructive) { tracker.eraseHistory() }
            }
            .onAppear { tracker.resumeIfNeeded(); tracker.resolveNames(for: tracker.stays()) }
        }
    }

    // MARK: Opt-in

    private var optIn: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "location.fill.viewfinder")
                .font(.system(size: 34)).foregroundStyle(.tint)
                .frame(width: 68, height: 68).glassEffect(.regular, in: .circle)
            Text("Where have you been?").font(.title2.weight(.bold))
            Text("Turn on location history to see a timeline of the places you visit and get suggestions for work time you may have forgotten to log.")
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 12) {
                point("lock.shield", "Private", "History is kept only on this iPhone and is never sent to the server.")
                point("battery.100percent", "Light on battery", "Checks in about once a minute while you are moving and rests while you are still.")
                point("location.fill", "Always visible", "iOS shows a blue indicator by the clock whenever tracking is active.")
                point("hand.raised", "You decide", "Turn it off or delete your history at any time.")
            }
            if tracker.isDenied {
                ErrorBanner(text: "Location access is turned off for Time Tracker. Allow it in Settings to use this.")
                Button { if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) } } label: {
                    Text("Open Settings").frame(maxWidth: .infinity).padding(.vertical, 6)
                }.buttonStyle(.glassProminent).controlSize(.large)
            } else {
                Button { tracker.enable() } label: {
                    Text("Turn on location history").fontWeight(.semibold).frame(maxWidth: .infinity).padding(.vertical, 6)
                }.buttonStyle(.glassProminent).controlSize(.large)
            }
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
                Text(tracker.isRunning ? "Location history is on" : (tracker.isDenied ? "Location access is off" : "Waiting for permission"))
                    .font(.headline)
                Spacer()
                if tracker.isRunning { Button("Turn off") { tracker.disable() }.buttonStyle(.glass).controlSize(.small) }
            }
            if tracker.isDenied {
                Text("Allow location access in Settings so Time Tracker can record places.").font(.subheadline).foregroundStyle(.secondary)
                Button("Open Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) } }
                    .buttonStyle(.glassProminent).controlSize(.small)
            } else if !tracker.isRunning {
                Button("Turn on") { tracker.enable() }.buttonStyle(.glassProminent).controlSize(.small)
            } else {
                Text("Recording about once a minute while you move. Stored only on this iPhone.").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .glassCard(radius: 22, padding: 16)
    }

    private func sectionTitle(_ t: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(t).font(.headline).foregroundStyle(Color.primary)
            Text(sub).font(.footnote).foregroundStyle(Color.primary.opacity(0.72)).textCase(nil)
        }.textCase(nil).padding(.top, 6)
    }

    private func dayHeader(_ day: DayTimeline) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(Self.dayTitle(day.day)).font(.headline).foregroundStyle(Color.primary)
            Spacer()
            Text("\(Fmt.duration(day.placeMinutes)) at places").font(.footnote).foregroundStyle(Color.primary.opacity(0.72))
        }.textCase(nil).padding(.top, 6)
    }

    private func suggestionCard(_ s: WorkSuggestion) -> some View {
        let n = tracker.name(for: s.stay)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "sparkles").foregroundStyle(.tint).frame(width: 26)
                VStack(alignment: .leading, spacing: 3) {
                    Text(n?.title ?? "Place near \(s.stay.lat.formatted(.number.precision(.fractionLength(3)))), \(s.stay.lon.formatted(.number.precision(.fractionLength(3))))")
                        .font(.headline)
                    Text("\(Self.dayTitle(Calendar.current.startOfDay(for: s.stay.start))) · \(Self.range(s.stay))")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Text(Fmt.duration(s.minutes)).font(.headline).foregroundStyle(.tint)
            }
            HStack(spacing: 10) {
                Button { editing = draft(for: s, name: n) } label: { Text("Add to timesheet").fontWeight(.semibold).frame(maxWidth: .infinity) }
                    .buttonStyle(.glassProminent)
                Button("Not work") { tracker.dismiss(s) }.buttonStyle(.glass)
            }.controlSize(.regular)
        }
        .rowCard()
        .listRowBackground(Color.clear).listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
    }

    private func draft(for s: WorkSuggestion, name: PlaceName?) -> EntryDraft {
        var d = EntryDraft(userId: app.me?.id ?? "")
        d.date = Calendar.current.startOfDay(for: s.stay.start)
        d.hours = s.minutes / 60; d.minutes = s.minutes % 60
        d.location = .on_site
        d.notes = "At \(name?.title ?? "a location") (\(Self.range(s.stay)))"
        return d
    }

    @ViewBuilder private func row(_ item: TimelineItem) -> some View {
        switch item {
        case .stay(let s):
            let n = tracker.name(for: s)
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: s.isHome ? "house.fill" : "mappin.circle.fill")
                    .font(.title3).foregroundStyle(s.isHome ? Color.secondary : Color.accentColor).frame(width: 30)
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.isHome ? "Home" : (n?.title ?? "Locating…")).font(.headline).lineLimit(2)
                    Text(Self.range(s) + ((n?.subtitle.isEmpty == false && !s.isHome) ? " · \(n!.subtitle)" : ""))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
                Spacer(minLength: 8)
                Text(Fmt.duration(s.minutes)).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
            }
            .rowCard()
        case .trip(let t):
            HStack(spacing: 14) {
                Image(systemName: "car.fill").font(.subheadline).foregroundStyle(.secondary).frame(width: 30)
                Text("Travel · \(Self.distance(t.meters)) · \(Fmt.duration(t.minutes))").font(.subheadline).foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal, 16).padding(.vertical, 4)
        }
    }

    // MARK: Formatting

    private static func range(_ s: Stay) -> String {
        "\(s.start.formatted(date: .omitted, time: .shortened)) – \(s.end.formatted(date: .omitted, time: .shortened))"
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
