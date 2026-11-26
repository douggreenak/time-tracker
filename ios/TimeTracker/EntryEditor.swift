import SwiftUI

struct EntryEditor: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State var draft: EntryDraft
    @State private var busy = false
    @State private var error: String?
    @State private var confirmDelete = false
    @State private var adding = false
    @State private var newName = ""
    @State private var addError: String?

    private var existing: TimeEntry? { app.entries.first { $0.id == draft.id } }
    private var customerOptions: [Option] {
        app.customers.filter { $0.isActive || $0.id == draft.customerId }.map { Option(id: $0.id, label: $0.name) }
    }
    private var canSave: Bool { (draft.totalMinutes > 0 || draft.lumpSum) && draft.totalMinutes <= 24 * 60 && !busy }

    var body: some View {
        NavigationStack {
            Form {
                if let e = existing, e.isInvoiced {
                    Section {
                        Label("This time was invoiced" + (e.invoicedOn.map { " on \($0)" } ?? "") + ". Changing it won't change that invoice.", systemImage: "info.circle")
                            .font(.footnote).foregroundStyle(.orange)
                    }
                }

                Section("When") {
                    DatePicker("Date", selection: $draft.date, displayedComponents: .date)
                    HStack(spacing: 0) {
                        Picker("Hours", selection: $draft.hours) { ForEach(0...24, id: \.self) { Text("\($0) hr").tag($0) } }
                        Picker("Minutes", selection: $draft.minutes) { ForEach(Array(stride(from: 0, to: 60, by: 6)), id: \.self) { Text("\($0) min").tag($0) } }
                    }
                    .pickerStyle(.wheel).frame(height: 110)
                    .labelsHidden()
                    Text("Time is billed in tenths of an hour (\(Fmt.hours(draft.totalMinutes)) h).").font(.footnote).foregroundStyle(.secondary)
                }

                Section("Customer") {
                    OptionMenu(title: "Customer", icon: "building.2", selection: $draft.customerId, options: customerOptions,
                               addTitle: "New customer…") { newName = ""; adding = true }
                }

                Section("Notes") {
                    TextField("What did you work on?", text: $draft.notes, axis: .vertical).lineLimit(2...8)
                }

                Section("Billing") {
                    Toggle("Billable", isOn: $draft.billable)
                    Toggle("Hold (don't invoice yet)", isOn: $draft.held)
                    Toggle("Lump sum", isOn: $draft.lumpSum)
                }

                Section("More") {
                    TextField("Parts used (and prices)", text: $draft.partsNote, axis: .vertical).lineLimit(1...4)
                    TextField("Internal note (not on invoice)", text: $draft.internalNote, axis: .vertical).lineLimit(1...4)
                    TextField("Contract / PO", text: $draft.contractPo)
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
            .alert("New customer", isPresented: $adding) {
                TextField("Name", text: $newName).textInputAutocapitalization(.words)
                Button("Add") { submitNew() }
                Button("Cancel", role: .cancel) {}
            }
            .alert("Couldn't add that", isPresented: Binding(get: { addError != nil }, set: { if !$0 { addError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(addError ?? "") }
            .confirmationDialog("Delete this entry?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    guard let e = existing else { return }
                    Task {
                        do { try await app.delete(e); dismiss() } catch { self.error = error.localizedDescription; await app.handle(error) }
                    }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func submitNew() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        Task {
            do { if let id = try await app.addCustomer(name) { draft.customerId = id } }
            catch { addError = error.localizedDescription; await app.handle(error) }
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
