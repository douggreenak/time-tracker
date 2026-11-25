import SwiftUI

struct DataView: View {
    enum Tab: String, CaseIterable, Identifiable { case customers = "Customers", tasks = "Tasks"; var id: String { rawValue } }
    enum Prompt { case customer, project(Customer), task }

    @Environment(AppState.self) private var app
    @State private var tab: Tab = .customers
    @State private var showArchived = false
    @State private var prompt: Prompt?
    @State private var text = ""
    @State private var billable = true
    @State private var error: String?

    private var customers: [Customer] { app.customers.filter { showArchived || $0.isActive } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("", selection: $tab) { ForEach(Tab.allCases) { Text($0.rawValue).tag($0) } }
                        .pickerStyle(.segmented)
                        .listRowBackground(Color.clear)
                }
                if let error { Section { ErrorBanner(text: error).listRowBackground(Color.clear) } }

                if tab == .customers {
                    if customers.isEmpty { EmptyState(icon: "building.2", title: "No customers", message: "Tap + to add one.").listRowBackground(Color.clear) }
                    ForEach(customers) { c in
                        Section {
                            ForEach(c.jobs.filter { showArchived || $0.isActive }) { j in
                                HStack {
                                    Label(j.name, systemImage: "square.stack.3d.up").foregroundStyle(j.isActive ? .primary : .secondary)
                                    if !j.isActive { Spacer(); Text("Archived").font(.caption).foregroundStyle(.secondary) }
                                }
                                .glassRow()
                                .swipeActions {
                                    if app.isManager {
                                        Button { toggle(job: j) } label: { Label(j.isActive ? "Archive" : "Restore", systemImage: j.isActive ? "archivebox" : "tray.and.arrow.up") }
                                            .tint(j.isActive ? .orange : .green)
                                    }
                                }
                            }
                            Button { text = ""; prompt = .project(c) } label: { Label("Add project", systemImage: "plus.circle") }
                                .glassRow()
                        } header: {
                            HStack {
                                Text(c.name).font(.headline).foregroundStyle(c.isActive ? .primary : .secondary)
                                if !c.isActive { Text("Archived").font(.caption).foregroundStyle(.secondary) }
                                Spacer()
                                if app.isManager {
                                    Button { toggle(customer: c) } label: { Image(systemName: c.isActive ? "archivebox" : "tray.and.arrow.up") }
                                        .buttonStyle(.glass).controlSize(.small)
                                }
                            }
                            .textCase(nil)
                        }
                    }
                } else {
                    if app.services.isEmpty { EmptyState(icon: "wrench.and.screwdriver", title: "No tasks", message: "Tap + to add one.").listRowBackground(Color.clear) }
                    Section {
                        ForEach(app.services) { s in
                            HStack {
                                Label(s.name, systemImage: "wrench.and.screwdriver")
                                Spacer()
                                Text(s.defaultBillable ? "Billable" : "Non-billable").font(.caption).foregroundStyle(.secondary)
                            }
                            .glassRow()
                        }
                    }
                }
            }
            .screenBackground()
            .refreshable { await app.refresh() }
            .screenHeader("Data") {
                if app.isManager && tab == .customers {
                    Button { showArchived.toggle() } label: { Label(showArchived ? "Hide archived" : "Show archived", systemImage: showArchived ? "archivebox.fill" : "archivebox") }
                }
                Button { text = ""; billable = true; prompt = tab == .customers ? .customer : .task } label: { Label("Add", systemImage: "plus") }
            }
            .alert(promptTitle, isPresented: Binding(get: { prompt != nil }, set: { if !$0 { prompt = nil } })) {
                TextField("Name", text: $text).textInputAutocapitalization(.words)
                Button("Add") { submitPrompt() }
                Button("Cancel", role: .cancel) {}
            } message: { if case .task = prompt { Text("New tasks are billable by default.") } }
        }
    }

    private var promptTitle: String {
        switch prompt {
        case .customer: "New customer"
        case .project(let c): "New project for \(c.name)"
        case .task: "New task"
        case nil: ""
        }
    }

    private func submitPrompt() {
        let name = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let p = prompt else { return }
        run {
            switch p {
            case .customer: try await app.addCustomer(name)
            case .project(let c): try await app.addProject(name, to: c.id)
            case .task: try await app.addTask(name, billable: billable)
            }
        }
    }

    private func toggle(customer c: Customer) { run { try await app.setCustomerActive(c, !c.isActive) } }
    private func toggle(job j: Job) { run { try await app.setJobActive(j, !j.isActive) } }

    private func run(_ work: @escaping () async throws -> Void) {
        error = nil
        Task { do { try await work() } catch { self.error = error.localizedDescription; await app.handle(error) } }
    }
}
