import SwiftUI

/// Accountant / admin view of everyone's time and where it stands in billing.
struct ReviewView: View {
    enum Filter: String, CaseIterable, Identifiable {
        case open = "To invoice", held = "Held", invoiced = "Invoiced", all = "All"
        var id: String { rawValue }
    }

    @Environment(AppState.self) private var app
    @State private var filter: Filter = .open
    @State private var detail: TimeEntry?
    @State private var search = ""

    private var visible: [TimeEntry] {
        app.entries.filter { e in
            switch filter {
            case .open: if e.statusValue != .open { return false }
            case .held: if e.statusValue != .held { return false }
            case .invoiced: if e.statusValue != .invoiced { return false }
            case .all: break
            }
            guard !search.isEmpty else { return true }
            let hay = "\(e.userName ?? "") \(e.title) \(e.subtitle) \(e.partsNote ?? "") \(e.contractPo ?? "")"
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
                if byPerson.isEmpty && app.syncError == nil {
                    EmptyState(icon: filter == .open ? "checkmark.circle" : "tray",
                               title: filter == .open ? "All caught up" : "Nothing here",
                               message: filter == .open ? "No time is waiting to be invoiced." : "No entries match.")
                        .listRowBackground(Color.clear)
                }
                ForEach(byPerson, id: \.name) { group in
                    Section {
                        ForEach(group.entries) { e in
                            Button { detail = e } label: { EntryRow(entry: e) }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .leading) {
                                    Button { Task { _ = await app.setInvoiced([e.id], !e.isInvoiced) } } label: {
                                        Label(e.isInvoiced ? "Not invoiced" : "Invoiced", systemImage: e.isInvoiced ? "arrow.uturn.backward" : "checkmark")
                                    }.tint(e.isInvoiced ? .orange : .green)
                                }
                                .swipeActions(edge: .trailing) {
                                    if !e.isInvoiced {
                                        Button { Task { _ = await app.setHeld([e.id], !e.isHeld) } } label: {
                                            Label(e.isHeld ? "Release" : "Hold", systemImage: e.isHeld ? "play.circle" : "pause.circle")
                                        }.tint(.orange)
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
        let open = app.entries.filter { $0.statusValue == .open && $0.isBillable }
        let held = app.entries.filter { $0.statusValue == .held }
        let people = Set(open.map(\.userId)).count
        return GlassEffectContainer(spacing: 12) {
            AdaptiveStack {
                tile("To invoice", Fmt.duration(open.reduce(0) { $0 + $1.durationMinutes }), "hourglass")
                tile("Held", Fmt.duration(held.reduce(0) { $0 + $1.durationMinutes }), "pause.circle")
                tile("People", "\(people)", "person.2")
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
        let todo = entries.filter { $0.statusValue == .open }
        return AdaptiveStack(spacing: 8) {
            Text(name).font(.headline).foregroundStyle(Color.primary)
            Text(Fmt.duration(entries.reduce(0) { $0 + $1.durationMinutes })).font(.subheadline).foregroundStyle(Color.primary.opacity(0.72))
            Spacer(minLength: 0)
            if !todo.isEmpty {
                Button {
                    Task {
                        let n = await app.setInvoiced(todo.map(\.id), true)
                        if n > 0 { app.toast = "Marked \(n) \(n == 1 ? "entry" : "entries") invoiced for \(name)" }
                    }
                } label: { Label("Invoiced \(todo.count)", systemImage: "checkmark.seal.fill").font(.caption.weight(.semibold)) }
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
                                StatusChip(status: e.statusValue)
                            }
                            Text(e.title).font(.title3.weight(.semibold))
                            Text(e.subtitle).foregroundStyle(.secondary)
                            Divider()
                            row("Date", Fmt.longDay(e.date), "calendar")
                            row("Duration", "\(Fmt.duration(e.durationMinutes))  (\(Fmt.hours(e.durationMinutes)) h)", "clock")
                            row("Billable", e.isBillable ? "Yes" : "No", "dollarsign.circle")
                            if e.isLumpSum { row("Lump sum", "Yes", "sum") }
                            if let po = e.contractPo, !po.isEmpty { row("Contract / PO", po, "number") }
                            if let on = e.invoicedOn, e.isInvoiced { row("Invoiced on", on, "checkmark.seal") }
                            if e.hasParts, let p = e.partsNote { Divider(); Label(p, systemImage: "shippingbox").font(.callout) }
                            if let n = e.internalNote, !n.isEmpty { Divider(); Label(n, systemImage: "lock").font(.callout).foregroundStyle(.secondary) }
                        }
                        .glassCard()

                        GlassEffectContainer(spacing: 12) {
                            VStack(spacing: 12) {
                                HStack(spacing: 12) {
                                    Button { Task { _ = await app.setInvoiced([entryId], !e.isInvoiced) } } label: {
                                        Label(e.isInvoiced ? "Mark not invoiced" : "Mark invoiced", systemImage: e.isInvoiced ? "arrow.uturn.backward" : "checkmark").frame(maxWidth: .infinity)
                                    }
                                    .buttonStyle(.glassProminent).tint(e.isInvoiced ? .orange : .green)
                                    if !e.isInvoiced {
                                        Button { Task { _ = await app.setHeld([entryId], !e.isHeld) } } label: {
                                            Label(e.isHeld ? "Release" : "Hold", systemImage: e.isHeld ? "play.circle" : "pause.circle").frame(maxWidth: .infinity)
                                        }
                                        .buttonStyle(.glass)
                                    }
                                }
                                Button { editing = EntryDraft(e) } label: { Label("Edit entry", systemImage: "pencil").frame(maxWidth: .infinity) }
                                    .buttonStyle(.glass)
                            }
                            .controlSize(.large)
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
}
