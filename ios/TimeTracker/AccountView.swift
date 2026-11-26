import SwiftUI

struct AccountView: View {
    @Environment(AppState.self) private var app
    @State private var changingPassword = false
    @Environment(LocationTracker.self) private var tracker
    @Environment(PlacesModel.self) private var places
    @State private var confirmSignOut = false
    @Environment(\.colorScheme) private var scheme
    @AppStorage(BackgroundSettings.enabledKey) private var bgEnabled = true
    @AppStorage(BackgroundSettings.intensityKey) private var bgIntensity = BackgroundSettings.defaultIntensity

    private var initials: String {
        (app.me?.name ?? "?").split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined()
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 16) {
                        Text(initials).font(.title2.weight(.semibold)).foregroundStyle(.primary)
                            .frame(width: 64, height: 64).glassEffect(.regular, in: .circle)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(app.me?.name ?? "").font(.title3.weight(.semibold))
                            Text(app.me?.email ?? "").font(.footnote).foregroundStyle(.secondary)
                            RoleChip(role: app.me?.role ?? "")
                        }
                    }
                    .padding(.vertical, 6)
                    .listRowBackground(Color.clear)
                }

                Section("Security") {
                    Button { changingPassword = true } label: { Label("Change password", systemImage: "key") }.glassRow()
                }

                Section("Appearance") {
                    VStack(alignment: .leading, spacing: 14) {
                        Toggle("Colorful background", isOn: $bgEnabled)
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("Intensity")
                                Spacer()
                                Text("\(Int((bgIntensity * 100).rounded()))%").foregroundStyle(.secondary).monospacedDigit()
                            }
                            Slider(value: $bgIntensity, in: 0...1)
                            HStack {
                                Text(scheme == .dark ? "Black" : "White")
                                Spacer()
                                Text("Vivid")
                            }
                            .font(.footnote).foregroundStyle(Color.primary.opacity(0.72))
                        }
                        .disabled(!bgEnabled).opacity(bgEnabled ? 1 : 0.45)
                        if bgEnabled, abs(bgIntensity - BackgroundSettings.defaultIntensity) > 0.005 {
                            Button("Reset to default") { bgIntensity = BackgroundSettings.defaultIntensity }
                                .font(.subheadline)
                        }
                    }
                    .padding(.vertical, 4)
                    .glassRow()
                }

                Section("Location") {
                    Button { app.requestedTab = 5 } label: {
                        HStack {
                            Label("Places & suggestions", systemImage: "location")
                            Spacer()
                            Text(tracker.isRunning ? "On" : "Off").foregroundStyle(.secondary)
                        }
                    }.glassRow()
                }

                if app.isManager {
                    Section("Team") {
                        ForEach(app.users) { u in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(u.name)
                                    Text(u.email).font(.footnote).foregroundStyle(.secondary)
                                }
                                Spacer()
                                RoleChip(role: u.role)
                            }
                            .glassRow()
                        }
                    }
                }

                Section("Sync") {
                    LabeledContent("Server", value: ServerConfig.url.host() ?? ServerConfig.url.absoluteString).glassRow()
                    LabeledContent("Entries loaded", value: "\(app.entries.count)").glassRow()
                    Button { Task { await app.refresh() } } label: { Label("Sync now", systemImage: "arrow.triangle.2.circlepath") }.glassRow()
                }

                Section {
                    Button(role: .destructive) { confirmSignOut = true } label: { Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right") }.glassRow()
                }
            }
            .contentMargins(.top, 0, for: .scrollContent)
            .listSectionSpacing(.compact)
            .screenBackground()
            .screenHeader("Account")
            .sheet(isPresented: $changingPassword) { PasswordSheet() }
            #if DEBUG
            .onAppear { if UserDefaults.standard.string(forKey: "debugSheet") == "password" { changingPassword = true } }
            #endif
            .confirmationDialog("Sign out of Time Tracker?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { Task { await tracker.syncNow(); tracker.disable(); tracker.eraseHistory(); places.reset(); await app.signOut() } }
            }
        }
    }
}

struct PasswordSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var new = ""
    @State private var confirm = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Current password", text: $current).textContentType(.password)
                    SecureField("New password", text: $new).textContentType(.newPassword)
                    SecureField("Repeat new password", text: $confirm).textContentType(.newPassword)
                } footer: { Text("At least 4 characters.") }
                if let error { Section { ErrorBanner(text: error).listRowBackground(Color.clear) } }
            }
            .navigationTitle("Change password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard new == confirm else { error = "The new passwords don't match."; return }
                        busy = true; error = nil
                        Task {
                            defer { busy = false }
                            do { try await app.changePassword(current: current, new: new); app.toast = "Password changed"; dismiss() }
                            catch { self.error = error.localizedDescription }
                        }
                    }
                    .disabled(current.isEmpty || new.count < 4 || busy)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
