import SwiftUI

struct DataView: View {
    @Environment(AppState.self) private var app
    @State private var showArchived = false
    @State private var adding = false
    @State private var text = ""
    @State private var error: String?

    private var customers: [Customer] { app.customers.filter { showArchived || $0.isActive } }

    var body: some View {
        NavigationStack {
            List {
                if let error { Section { ErrorBanner(text: error).listRowBackground(Color.clear) } }
                if customers.isEmpty && app.syncError == nil {
                    EmptyState(icon: "building.2", title: "No customers", message: "Tap + to add one.").listRowBackground(Color.clear)
                }
                Section {
                    ForEach(customers) { c in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Label(c.name, systemImage: "building.2").foregroundStyle(c.isActive ? .primary : .secondary)
                                if let last = c.lastInvoiceDate, !last.isEmpty {
                                    Text("Last invoiced through \(last)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            if !c.isActive { Spacer(); Text("Archived").font(.caption).foregroundStyle(.secondary) }
                        }
                        .glassRow()
                        .swipeActions {
                            if app.isManager {
                                Button { toggle(c) } label: { Label(c.isActive ? "Archive" : "Restore", systemImage: c.isActive ? "archivebox" : "tray.and.arrow.up") }
                                    .tint(c.isActive ? .orange : .green)
                            }
                        }
                    }
                }
            }
            .contentMargins(.top, 0, for: .scrollContent)
            .listSectionSpacing(.compact)
            .screenBackground()
            .refreshable { await app.refresh() }
            .screenHeader("Customers") {
                if app.isManager {
                    Button { showArchived.toggle() } label: { Label(showArchived ? "Hide archived" : "Show archived", systemImage: showArchived ? "archivebox.fill" : "archivebox") }
                }
                Button { text = ""; adding = true } label: { Label("Add", systemImage: "plus") }
            }
            .alert("New customer", isPresented: $adding) {
                TextField("Name", text: $text).textInputAutocapitalization(.words)
                Button("Add") { submit() }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private func submit() {
        let name = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        run { try await app.addCustomer(name) }
    }

    private func toggle(_ c: Customer) { run { try await app.setCustomerActive(c, !c.isActive) } }

    private func run(_ work: @escaping () async throws -> Void) {
        error = nil
        Task { do { try await work() } catch { self.error = error.localizedDescription; await app.handle(error) } }
    }
}
