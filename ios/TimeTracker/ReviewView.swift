import SwiftUI

struct ReviewView: View {
    enum Filter: String, CaseIterable, Identifiable {
        case pending = "To review", approved = "Approved", all = "All"
        var id: String { rawValue }
    }

    @Environment(AppState.self) private var app
    @State private var filter: Filter = .pending
    @State private var detail: TimeEntry?
    @State private var search = ""

    private var visible: [TimeEntry] {
        app.entries.filter { e in
            switch filter {
            case .pending: if !(e.status == "submitted" || e.isFlagged) { return false }
            case .approved: if !(e.status == "approved" || e.status == "exported") { return false }
            case .all: break
            }
            guard !search.isEmpty else { return true }
            let hay = "\(e.userName ?? "") \(e.title) \(e.subtitle) \(e.notes ?? "")"
            return hay.localizedCaseInsensitiveContains(search)
        }
    }

    private func grouped(_ visible: [TimeEntry]) -> [(name: String, entries: [TimeEntry])] {
        Dictionary(grouping: visible) { $0.userName ?? "Unknown" }
            .map { (name: $0.key, entries: $0.value.sorted { $0.date > $1.date }) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        let byPerson = grouped(visible)
        return NavigationStack {
            List {
                Section {
                    VStack(spacing: 14) {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                            TextField("Search people, customers, notes", text: $search)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                            if !search.isEmpty {
                                Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }.buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .background(.ultraThinMaterial, in: Capsule())
                        Picker("Filter", selection: $filter) { ForEach(Filter.allCases) { Text($0.rawValue).tag($0) } }
                            .pickerStyle(.segmented)
                        stats
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                }
                if byPerson.isEmpty {
                    EmptyState(icon: filter == .pending ? "checkmark.circle" : "tray",
                               title: filter == .pending ? "All caught up" : "Nothing here",
                               message: filter == .pending ? "No submitted time is waiting for review." : "No entries match.")
                        .listRowBackground(Color.clear)
                }
                ForEach(byPerson, id: \.name) { group in
                    Section {
                        ForEach(group.entries) { e in
                            Button { detail = e } label: { EntryRow(entry: e, showUser: false) }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .leading) {
                                    if e.status != "approved" && e.status != "exported" {
                                        Button { Task { await app.setStatus([e.id], to: .approved) } } label: { Label("Approve", systemImage: "checkmark") }.tint(.green)
                                    }
                                }
                                .swipeActions(edge: .trailing) {
                                    if e.status == "submitted" || e.isLocked {
                                        Button { Task { await app.setStatus([e.id], to: .draft) } } label: { Label("Send back", systemImage: "arrow.uturn.backward") }.tint(.orange)
                                    }
                                }
                        }
                    } header: { personHeader(group.name, group.entries) }
                }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListHeaderHeight, 0)
            .listSectionSpacing(.custom(0))
            .screenBackground()
            .refreshable { await app.refresh() }
            .screenHeader("Review")
            .sheet(item: $detail) { e in ReviewDetail(entryId: e.id) }
            #if DEBUG
            .onAppear {
                if UserDefaults.standard.string(forKey: "debugSheet") == "detail", detail == nil { detail = visible.first }
            }
            #endif
        }
    }

    private var stats: some View {
        let pending = app.entries.filter { $0.status == "submitted" }
        let minutes = pending.reduce(0) { $0 + $1.durationMinutes }
        let people = Set(pending.map(\.userId)).count
        let flagged = app.entries.filter(\.isFlagged).count
        return GlassEffectContainer(spacing: 12) {
            AdaptiveStack {
                tile("Awaiting", Fmt.duration(minutes), "hourglass")
                tile("People", "\(people)", "person.2")
                tile("Questions", "\(flagged)", "questionmark.bubble")
            }
        }
    }

    private func tile(_ t: String, _ v: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).foregroundStyle(.tint)
            Text(v).font(.title3.weight(.semibold)).minimumScaleFactor(0.7).lineLimit(1)
            Text(t).font(.footnote).foregroundStyle(.secondary)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
    }

    private func personHeader(_ name: String, _ entries: [TimeEntry]) -> some View {
        let submitted = entries.filter { $0.status == "submitted" }
        return AdaptiveStack(spacing: 8) {
            Text(name).font(.headline).foregroundStyle(Color.primary)
            Text(Fmt.duration(entries.reduce(0) { $0 + $1.durationMinutes })).font(.subheadline).foregroundStyle(Color.primary.opacity(0.72))
            Spacer(minLength: 0)
            if !submitted.isEmpty {
                Button {
                    Task {
                        let n = await app.setStatus(submitted.map(\.id), to: .approved)
                        app.toast = "Approved \(n) \(n == 1 ? "entry" : "entries") for \(name)"
                    }
                } label: { Label("Approve \(submitted.count)", systemImage: "checkmark.seal.fill").font(.caption.weight(.semibold)) }
                .buttonStyle(.glassProminent).controlSize(.small).tint(.green)
            }
        }
        .textCase(nil).padding(.top, 6)
    }
}

struct ReviewDetail: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let entryId: String
    @State private var question = ""
    @State private var error: String?
    @State private var editing: EntryDraft?

    private var entry: TimeEntry? { app.entries.first { $0.id == entryId } }

    var body: some View {
        NavigationStack {
            if let e = entry {
                ScrollView {
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(e.userName ?? "").font(.headline)
                                Spacer()
                                StatusChip(status: e.statusValue, flagged: e.isFlagged)
                            }
                            Text(e.title).font(.title3.weight(.semibold))
                            Text(e.subtitle).foregroundStyle(.secondary)
                            Divider()
                            row("Date", Fmt.longDay(e.date), "calendar")
                            row("Duration", "\(Fmt.duration(e.durationMinutes))  (\(Fmt.hours(e.durationMinutes)) h)", "clock")
                            row("Location", e.location.label, e.location.icon)
                            row("Billable", e.isBillable ? "Yes" : "No", "dollarsign.circle")
                            if let n = e.notes, !n.isEmpty { Divider(); Text(n).font(.callout) }
                        }
                        .glassCard()

                        if e.isFlagged, let r = e.flagReason {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Open question", systemImage: "questionmark.bubble.fill").font(.subheadline.weight(.semibold)).foregroundStyle(.orange)
                                Text(r).font(.callout)
                                Button("Withdraw question") { run { try await app.withdrawQuestion(e) } }.buttonStyle(.glass).controlSize(.small)
                            }
                            .glassCard(tint: .orange)
                        }

                        GlassEffectContainer(spacing: 12) {
                            VStack(spacing: 12) {
                                HStack(spacing: 12) {
                                    if !e.isLocked {
                                        Button { setStatus(.approved) } label: { Label("Approve", systemImage: "checkmark").frame(maxWidth: .infinity) }
                                            .buttonStyle(.glassProminent).tint(.green)
                                    }
                                    if e.status == "approved" {
                                        Button { setStatus(.exported) } label: { Label("Mark sent to QuickBooks", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }
                                            .buttonStyle(.glassProminent).tint(.purple)
                                    }
                                    if e.status != "draft" {
                                        Button { setStatus(.draft) } label: { Label("Send back", systemImage: "arrow.uturn.backward").frame(maxWidth: .infinity) }
                                            .buttonStyle(.glass)
                                    }
                                }
                                Button { editing = EntryDraft(e) } label: { Label("Edit entry", systemImage: "pencil").frame(maxWidth: .infinity) }
                                    .buttonStyle(.glass)
                            }
                            .controlSize(.large)
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Ask a question").font(.subheadline.weight(.semibold))
                            TextField("e.g. Which site was this for?", text: $question, axis: .vertical)
                                .lineLimit(1...4).insetField()
                            Button("Send question") {
                                let q = question.trimmingCharacters(in: .whitespacesAndNewlines)
                                run { try await app.ask(e, question: q); question = "" }
                            }
                            .buttonStyle(.glass).disabled(question.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                        .glassCard()

                        if let error { ErrorBanner(text: error) }

                        if let h = e.flagHistory, !h.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("History").font(.subheadline.weight(.semibold))
                                ForEach(h.reversed(), id: \.at) { n in
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(n.text).font(.callout)
                                        Text("\(n.by) · \(n.kind)").font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .glassCard()
                        }
                    }
                    .padding(16)
                }
                .background { AuroraBackground() }
                .navigationTitle("Entry")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                .sheet(item: $editing) { d in EntryEditor(draft: d) }
            } else {
                EmptyState(icon: "questionmark.folder", title: "Entry not found", message: "It may have been deleted.")
            }
        }
    }

    private func row(_ k: String, _ v: String, _ icon: String) -> some View {
        HStack { Label(k, systemImage: icon).foregroundStyle(.secondary); Spacer(); Text(v) }.font(.subheadline)
    }

    private func setStatus(_ s: EntryStatus) { Task { await app.setStatus([entryId], to: s) } }

    private func run(_ work: @escaping () async throws -> Void) {
        error = nil
        Task { do { try await work() } catch { self.error = error.localizedDescription } }
    }
}
