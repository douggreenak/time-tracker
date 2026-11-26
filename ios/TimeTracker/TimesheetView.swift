import SwiftUI

struct WeekGroup: Identifiable {
    let start: String
    let entries: [TimeEntry]
    var id: String { start }
    var minutes: Int { entries.reduce(0) { $0 + $1.durationMinutes } }
    var billable: Int { entries.filter(\.isBillable).reduce(0) { $0 + $1.durationMinutes } }
}

func groupByWeek(_ entries: [TimeEntry]) -> [WeekGroup] {
    Dictionary(grouping: entries) { Fmt.weekStart($0.date) }
        .map { WeekGroup(start: $0.key, entries: $0.value.sorted { $0.date > $1.date }) }
        .sorted { $0.start > $1.start }
}

struct TimesheetView: View {
    @Environment(AppState.self) private var app
    @Environment(LocationTracker.self) private var tracker
    @State private var editing: EntryDraft?
    @State private var error: String?
    @State private var showPlaces = false

    var body: some View {
        let weeks = groupByWeek(app.myEntries)
        let thisWeek = weeks.first { $0.start == Fmt.weekStart(Fmt.today) }
        return NavigationStack {
            List {
                Section {
                    summary(thisWeek)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                }
                if let error {
                    Section { ErrorBanner(text: error).listRowBackground(Color.clear) }
                }
                let suggested = tracker.enabled ? tracker.suggestions(entries: app.myEntries).count : 0
                if suggested > 0 {
                    Section {
                        Button { showPlaces = true } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "sparkles").foregroundStyle(.tint)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(suggested) suggested work \(suggested == 1 ? "session" : "sessions")").font(.headline)
                                    Text("Based on where you've been. Review and add.").font(.subheadline).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 8)
                                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                            }
                            .rowCard()
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16))
                    }
                }
                if weeks.isEmpty && !app.loadingEntries && app.syncError == nil {
                    EmptyState(icon: "calendar.badge.plus", title: "No time yet",
                               message: "Start the timer or tap + to add your first entry.")
                        .listRowBackground(Color.clear)
                }
                ForEach(weeks) { week in
                    Section {
                        ForEach(week.entries) { e in
                            Button { editing = EntryDraft(e) } label: { EntryRow(entry: e) }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .listRowSeparator(.hidden)
                                .swipeActions(edge: .trailing) {
                                    if !e.isLocked || app.isManager {
                                        Button(role: .destructive) { delete(e) } label: { Label("Delete", systemImage: "trash") }
                                    }
                                }
                                .swipeActions(edge: .leading) {
                                    if !e.isInvoiced {
                                        Button { Task { _ = await app.setHeld([e.id], !e.isHeld) } } label: {
                                            Label(e.isHeld ? "Release" : "Hold", systemImage: e.isHeld ? "play.circle" : "pause.circle")
                                        }.tint(.orange)
                                    }
                                }
                        }
                    } header: { weekHeader(week) }
                }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListHeaderHeight, 0)
            .listSectionSpacing(.custom(0))
            .screenBackground()
            .refreshable { await app.refresh() }
            .screenHeader("Timesheet") {
                Button { showPlaces = true } label: { Label("Places", systemImage: tracker.isRunning ? "location.fill" : "location") }
                Button { editing = EntryDraft(userId: app.me?.id ?? "") } label: { Label("Add time", systemImage: "plus") }
            }
            .sheet(item: $editing) { d in EntryEditor(draft: d) }
            .sheet(isPresented: $showPlaces) { PlacesView() }
            #if DEBUG
            .onAppear {
                if UserDefaults.standard.string(forKey: "debugSheet") == "places" { showPlaces = true }
                if UserDefaults.standard.string(forKey: "debugSheet") == "editor", editing == nil {
                    editing = app.myEntries.first.map { EntryDraft($0) } ?? EntryDraft(userId: app.me?.id ?? "")
                }
            }
            #endif
        }
    }

    private func summary(_ thisWeek: WeekGroup?) -> some View {
        let today = app.myEntries.filter { $0.date == Fmt.today }.reduce(0) { $0 + $1.durationMinutes }
        let wk = thisWeek?.minutes ?? 0
        let billable = thisWeek?.billable ?? 0
        let pct = wk > 0 ? Int((Double(billable) / Double(wk) * 100).rounded()) : 0
        return GlassEffectContainer(spacing: 12) {
            AdaptiveStack {
                stat("Today", Fmt.duration(today), "sun.max")
                stat("This week", Fmt.duration(wk), "calendar")
                stat("Billable", "\(pct)%", "dollarsign.circle")
            }
        }
    }

    private func stat(_ title: String, _ value: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).font(.subheadline).foregroundStyle(.tint)
            Text(value).font(.title3.weight(.semibold)).minimumScaleFactor(0.7).lineLimit(1)
            Text(title).font(.footnote).foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
    }

    private func weekHeader(_ w: WeekGroup) -> some View {
        AdaptiveStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(Fmt.weekTag(w.start) ?? Fmt.weekLabel(w.start)).font(.headline).foregroundStyle(Color.primary)
                if Fmt.weekTag(w.start) != nil { Text(Fmt.weekLabel(w.start)).font(.footnote).foregroundStyle(Color.primary.opacity(0.72)) }
            }
            Spacer(minLength: 0)
            Text(Fmt.duration(w.minutes)).font(.subheadline.weight(.semibold)).foregroundStyle(Color.primary)
        }
        .textCase(nil)
        .padding(.top, 6)
    }

    private func delete(_ e: TimeEntry) {
        Task {
            do { try await app.delete(e); error = nil }
            catch { self.error = error.localizedDescription; await app.handle(error) }
        }
    }
}

struct EntryRow: View {
    let entry: TimeEntry
    var compact = false
    var showUser = false

    var body: some View {
        let row = HStack(alignment: .top, spacing: 12) {
            if !compact {
                VStack(spacing: 1) {
                    Text(Fmt.dayLabel(entry.date).split(separator: " ").first.map(String.init) ?? "").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    Text(Fmt.dayLabel(entry.date).split(separator: " ").last.map(String.init) ?? "").font(.title3.weight(.semibold))
                }
                .frame(width: 38)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.title).font(.subheadline.weight(.semibold)).lineLimit(2)
                Text(showUser ? "\(entry.userName ?? "") · \(entry.subtitle)" : entry.subtitle)
                    .font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 5) {
                Text(entry.isLumpSum && entry.durationMinutes == 0 ? "Lump" : Fmt.duration(entry.durationMinutes)).font(.subheadline.weight(.semibold)).monospacedDigit()
                HStack(spacing: 4) {
                    if !entry.isBillable { Image(systemName: "nosign").font(.caption2).foregroundStyle(.secondary) }
                    if entry.hasParts { Image(systemName: "shippingbox").font(.caption2).foregroundStyle(.secondary) }
                    if !compact && entry.statusValue != .open { StatusChip(status: entry.statusValue) }
                }
            }
        }
        .contentShape(Rectangle())

        if compact { row } else { row.rowCard() }
    }
}
