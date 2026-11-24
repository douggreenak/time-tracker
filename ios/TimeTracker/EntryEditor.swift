import SwiftUI

struct EntryEditor: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State var draft: EntryDraft
    @State private var busy = false
    @State private var error: String?
    @State private var confirmDelete = false
    private enum NewItem: Identifiable { case customer, project, task; var id: Int { hashValue } }
    @State private var adding: NewItem?
    @State private var newName = ""
    @State private var newBillable = true
    @State private var addError: String?
    private var locationChoices: [LocationKind] {
        // New entries offer Office and On-site; an old entry keeps whatever it already had.
        [.office, .on_site] + ([LocationKind.remote, .travel].filter { $0 == draft.location })
    }

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
                        Label((e.status == "exported" ? "This entry has already gone to QuickBooks." : "This entry is approved.") + " Changing it sends it back to your accountant for another look.", systemImage: "info.circle")
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
                    OptionMenu(title: "Customer", icon: "building.2", selection: $draft.customerId, options: customerOptions,
                               addTitle: "New customer…") { prompt(.customer) }
                    OptionMenu(title: "Project", icon: "square.stack.3d.up", selection: $draft.jobId, options: jobs,
                               disabled: draft.customerId.isEmpty, addTitle: "New project…") { prompt(.project) }
                    OptionMenu(title: "Task", icon: "wrench.and.screwdriver", selection: $draft.serviceItemId,
                               options: app.services.map { Option(id: $0.id, label: $0.name) },
                               addTitle: "New task…") { prompt(.task) }
                }

                Section("Where") {
                    Picker("Location", selection: $draft.location) {
                        ForEach(locationChoices) { Label($0.label, systemImage: $0.icon).tag($0) }
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
            .alert(addTitle, isPresented: Binding(get: { adding != nil }, set: { if !$0 { adding = nil } })) {
                TextField("Name", text: $newName).textInputAutocapitalization(.words)
                Button("Add") { submitNew() }
                Button("Cancel", role: .cancel) {}
            } message: { if adding == .task { Text("New tasks are billable by default.") } }
            .alert("Couldn't add that", isPresented: Binding(get: { addError != nil }, set: { if !$0 { addError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(addError ?? "") }
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

    private var addTitle: String {
        switch adding {
        case .customer: "New customer"
        case .project: "New project for \(app.customer(draft.customerId)?.name ?? "customer")"
        case .task: "New task"
        case nil: ""
        }
    }

    private func prompt(_ kind: NewItem) { newName = ""; newBillable = true; adding = kind }

    private func submitNew() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let kind = adding else { return }
        Task {
            do {
                switch kind {
                case .customer:
                    if let id = try await app.addCustomer(name) { draft.customerId = id; draft.jobId = "" }
                case .project:
                    if let id = try await app.addProject(name, to: draft.customerId) { draft.jobId = id }
                case .task:
                    if let id = try await app.addTask(name, billable: newBillable) { draft.serviceItemId = id }
                }
            } catch { addError = error.localizedDescription; await app.handle(error) }
        }
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
