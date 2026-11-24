import SwiftUI

struct EntryEditor: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State var draft: EntryDraft
    @State private var busy = false
    @State private var error: String?
    @State private var confirmDelete = false

    private var existing: TimeEntry? { app.entries.first { $0.id == draft.id } }
    private var jobs: [Option] {
        (app.customer(draft.customerId)?.jobs ?? []).filter { $0.isActive || $0.id == draft.jobId }.map { Option(id: $0.id, label: $0.name) }
    }
    private var customerOptions: [Option] {
        app.customers.filter { $0.isActive || $0.id == draft.customerId }.map { Option(id: $0.id, label: $0.name) }
    }
    private var canSave: Bool { draft.totalMinutes > 0 && draft.totalMinutes <= 24 * 60 && !busy }

    var body: some View {
        NavigationStack {
            Form {
                if let e = existing, e.isLocked {
                    Section {
                        Label("This entry is \(e.status). Changing it sends it back to your accountant for another look.", systemImage: "info.circle")
                            .font(.footnote).foregroundStyle(.orange)
                    }
                }
                if let e = existing, e.isFlagged, let reason = e.flagReason {
                    Section("Question") { Text(reason).font(.callout) }
                }

                Section("When") {
                    DatePicker("Date", selection: $draft.date, displayedComponents: .date)
                    HStack(spacing: 0) {
                        Picker("Hours", selection: $draft.hours) { ForEach(0...24, id: \.self) { Text("\($0) hr").tag($0) } }
                        Picker("Minutes", selection: $draft.minutes) { ForEach(0..<60, id: \.self) { Text("\($0) min").tag($0) } }
                    }
                    .pickerStyle(.wheel).frame(height: 110)
                    .labelsHidden()
                }

                Section("What") {
                    OptionMenu(title: "Customer", icon: "building.2", selection: $draft.customerId, options: customerOptions)
                    OptionMenu(title: "Project", icon: "square.stack.3d.up", selection: $draft.jobId, options: jobs, disabled: draft.customerId.isEmpty)
                    OptionMenu(title: "Task", icon: "wrench.and.screwdriver", selection: $draft.serviceItemId,
                               options: app.services.map { Option(id: $0.id, label: $0.name) })
                }

                Section("Where") {
                    Picker("Location", selection: $draft.location) {
                        ForEach(LocationKind.allCases) { Label($0.label, systemImage: $0.icon).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Toggle("Billable", isOn: $draft.billable)
                }

                Section("Notes") {
                    TextField("What did you work on?", text: $draft.notes, axis: .vertical).lineLimit(2...8)
                }

                if let e = existing, let history = e.flagHistory, !history.isEmpty {
                    Section("History") {
                        ForEach(history.reversed(), id: \.at) { n in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(n.text).font(.callout)
                                Text("\(n.by) · \(n.kind)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if let error { Section { ErrorBanner(text: error).listRowBackground(Color.clear) } }

                if let e = existing, !e.isLocked || app.isManager {
                    Section { Button("Delete entry", role: .destructive) { confirmDelete = true } }
                }
            }
            .navigationTitle(draft.id == nil ? "New entry" : "Edit entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: { if busy { ProgressView() } else { Text("Save").fontWeight(.semibold) } }
                        .disabled(!canSave)
                }
            }
            .onChange(of: draft.customerId) { _, _ in if !jobs.contains(where: { $0.id == draft.jobId }) { draft.jobId = "" } }
            .onChange(of: draft.serviceItemId) { old, new in
                // A new task brings its default billable setting (only while adding).
                if draft.id == nil, let s = app.services.first(where: { $0.id == new }) { draft.billable = s.defaultBillable }
            }
            .confirmationDialog("Delete this entry?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    guard let e = existing else { return }
                    Task {
                        do { try await app.delete(e); dismiss() } catch { self.error = error.localizedDescription }
                    }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func save() {
        busy = true; error = nil
        Task {
            defer { busy = false }
            do { try await app.save(draft); dismiss() }
            catch { self.error = error.localizedDescription; await app.handle(error) }
        }
    }
}
