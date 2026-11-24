import SwiftUI

struct WeekGroup: Identifiable {
    let start: String
    let entries: [TimeEntry]
    var id: String { start }
    var minutes: Int { entries.reduce(0) { $0 + $1.durationMinutes } }
    var billable: Int { entries.filter(\.isBillable).reduce(0) { $0 + $1.durationMinutes } }
    var drafts: [TimeEntry] { entries.filter { $0.status == "draft" } }
}

func groupByWeek(_ entries: [TimeEntry]) -> [WeekGroup] {
    Dictionary(grouping: entries) { Fmt.weekStart($0.date) }
        .map { WeekGroup(start: $0.key, entries: $0.value.sorted { $0.date > $1.date }) }
        .sorted { $0.start > $1.start }
}

struct TimesheetView: View {
    @Environment(AppState.self) private var app
    @State private var editing: EntryDraft?
    @State private var error: String?

    private var weeks: [WeekGroup] { groupByWeek(app.myEntries) }
    private var thisWeek: WeekGroup? { weeks.first { $0.start == Fmt.weekStart(Fmt.today) } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    summary
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                }
                if let error {
                    Section { ErrorBanner(text: error).listRowBackground(Color.clear) }
                }
                if weeks.isEmpty && !app.loadingEntries {
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
                                    if e.status == "draft" {
                                        Button { submit([e]) } label: { Label("Submit", systemImage: "paperplane") }.tint(.blue)
                                    } else if e.status == "submitted" && !app.isManager {
                                        Button { unsubmit(e) } label: { Label("Recall", systemImage: "arrow.uturn.backward") }.tint(.orange)
                                    }
                                }
                        }
                    } header: { weekHeader(week) }
                }
            }
            .listStyle(.plain)
            .screenBackground()
            .refreshable { await app.refresh() }
            .navigationTitle("Timesheet")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { editing = EntryDraft(userId: app.me?.id ?? "") } label: { Label("Add time", systemImage: "plus") }
                }
            }
            .sheet(item: $editing) { d in EntryEditor(draft: d) }
        }
    }

    private var summary: some View {
        let today = app.myEntries.filter { $0.date == Fmt.today }.reduce(0) { $0 + $1.durationMinutes }
        let wk = thisWeek?.minutes ?? 0
        let billable = thisWeek?.billable ?? 0
        let pct = wk > 0 ? Int((Double(billable) / Double(wk) * 100).rounded()) : 0
        return GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
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
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
    }

    private func weekHeader(_ w: WeekGroup) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(Fmt.weekTag(w.start) ?? Fmt.weekLabel(w.start)).font(.headline).foregroundStyle(.primary)
                if Fmt.weekTag(w.start) != nil { Text(Fmt.weekLabel(w.start)).font(.caption).foregroundStyle(.secondary) }
            }
            Spacer()
            Text(Fmt.duration(w.minutes)).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
            if !w.drafts.isEmpty {
                Button { submit(w.drafts) } label: { Label("Submit \(w.drafts.count)", systemImage: "paperplane.fill").font(.caption.weight(.semibold)) }
                    .buttonStyle(.glassProminent).controlSize(.small)
            }
        }
        .textCase(nil)
        .padding(.top, 6)
    }

    private func submit(_ list: [TimeEntry]) {
        Task {
            let n = await app.setStatus(list.map(\.id), to: .submitted)
            app.toast = n == list.count ? "Submitted \(n) \(n == 1 ? "entry" : "entries") for review" : "Only \(n) of \(list.count) were submitted"
        }
    }

    private func unsubmit(_ e: TimeEntry) { Task { await app.setStatus([e.id], to: .draft) } }

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
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                if let n = entry.notes, !n.isEmpty, n != "Recorded with stopwatch" {
                    Text(n).font(.caption).foregroundStyle(.tertiary).lineLimit(1)
                }
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 5) {
                Text(Fmt.duration(entry.durationMinutes)).font(.subheadline.weight(.semibold)).monospacedDigit()
                HStack(spacing: 4) {
                    if !entry.isBillable { Image(systemName: "nosign").font(.caption2).foregroundStyle(.secondary) }
                    Image(systemName: entry.location.icon).font(.caption2).foregroundStyle(.secondary)
                    if !compact { StatusChip(status: entry.statusValue, flagged: entry.isFlagged) }
                }
            }
        }
        .contentShape(Rectangle())

        if compact { row } else { row.glassCard(radius: 20, padding: 12) }
    }
}
