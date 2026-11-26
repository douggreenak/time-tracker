import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var app
    @State private var directory: LoginDirectory?
    @State private var userId = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var showServer = false
    @State private var server = UserDefaults.standard.string(forKey: ServerConfig.key) ?? ServerConfig.defaultURL
    @FocusState private var focused: Bool

    private var selectedName: String { directory?.users.first { $0.id == userId }?.name ?? "Choose your name" }

    var body: some View {
        ZStack {
            AuroraBackground()
            ScrollView {
                VStack(spacing: 28) {
                    VStack(spacing: 14) {
                        Image(systemName: "clock.badge.checkmark")
                            .font(.system(size: 44, weight: .medium))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(.tint)
                            .frame(width: 92, height: 92)
                            .glassEffect(.regular, in: .circle)
                        Text("Time Tracker").font(.largeTitle.bold())
                        Text("Field & office timesheets, synced to the cloud.")
                            .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                    .padding(.top, 60)

                    VStack(spacing: 14) {
                        if let directory, directory.needsSetup {
                            Label("No accounts exist yet. Create the first admin on the website, then sign in here.", systemImage: "person.badge.plus")
                                .font(.subheadline)
                        } else {
                            Menu {
                                ForEach(directory?.users ?? []) { p in
                                    Button { userId = p.id } label: { Text("\(p.name) — \(p.role.capitalized)") }
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "person.fill").foregroundStyle(.tint)
                                    Text(selectedName).foregroundStyle(userId.isEmpty ? .secondary : .primary)
                                    Spacer()
                                    Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundStyle(.tertiary)
                                }
                                .padding(14)
                                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            }

                            HStack {
                                Image(systemName: "lock.fill").foregroundStyle(.tint)
                                SecureField("Password", text: $password)
                                    .textContentType(.password)
                                    .focused($focused)
                                    .submitLabel(.go)
                                    .onSubmit { Task { await signIn() } }
                            }
                            .padding(14)
                            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                            if let error { ErrorBanner(text: error) }

                            Button { Task { await signIn() } } label: {
                                Group { if busy { ProgressView() } else { Text("Sign in").fontWeight(.semibold) } }
                                    .frame(maxWidth: .infinity).padding(.vertical, 6)
                            }
                            .buttonStyle(.glassProminent).tint(.buttonBlue)
                            .disabled(busy)
                            .controlSize(.large)
                        }
                    }
                    .glassCard(radius: 32, padding: 20)

                    Button { showServer.toggle() } label: {
                        Label("Server", systemImage: "server.rack").font(.footnote)
                    }
                    .buttonStyle(.plain).foregroundStyle(.secondary)

                    if showServer {
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("https://…", text: $server)
                                .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                                .insetField()
                            HStack {
                                Button("Reset") { server = ServerConfig.defaultURL; applyServer() }
                                Spacer()
                                Button("Use this server") { applyServer() }.buttonStyle(.glass)
                            }
                            .font(.footnote)
                        }
                        .glassCard(radius: 22)
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .task { await loadDirectory() }
    }

    private func loadDirectory() async {
        do {
            let d: LoginDirectory = try await APIClient.shared.get("api/auth/users")
            directory = d
            if userId.isEmpty, let last = UserDefaults.standard.string(forKey: "lastUser"), d.users.contains(where: { $0.id == last }) { userId = last }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func applyServer() {
        let v = server.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(v == ServerConfig.defaultURL ? nil : v, forKey: ServerConfig.key)
        directory = nil; userId = ""
        Task { await loadDirectory() }
    }

    private func signIn() async {
        guard !busy else { return }
        if userId.isEmpty { error = "Choose your name first."; return }
        if password.isEmpty { error = "Enter your password."; return }
        busy = true; error = nil
        defer { busy = false }
        do {
            try await app.signIn(userId: userId, password: password)
            UserDefaults.standard.set(userId, forKey: "lastUser")
            password = ""
        } catch { self.error = error.localizedDescription }
    }
}
