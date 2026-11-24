import SwiftUI

@main
struct TimeTrackerApp: App {
    @State private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .task {
                    await app.bootstrap()
                    #if DEBUG
                    // Test hook: -debugUser "Priya Nair" -debugPassword demo1234
                    let d = UserDefaults.standard
                    if let name = d.string(forKey: "debugUser"), let pw = d.string(forKey: "debugPassword"),
                       let dir: LoginDirectory = try? await APIClient.shared.get("api/auth/users"),
                       let p = dir.users.first(where: { $0.name == name }), app.me?.name != name {
                        if case .signedIn = app.phase { await app.signOut() }
                        try? await app.signIn(userId: p.id, password: pw)
                    }
                    #endif
                }
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var app
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch app.phase {
            case .launching:
                ZStack { AuroraBackground(); ProgressView().controlSize(.large) }
            case .signedOut:
                LoginView()
            case .offline(let message):
                ZStack {
                    AuroraBackground()
                    VStack(spacing: 16) {
                        EmptyState(icon: "wifi.slash", title: "Can't connect", message: message)
                        Button("Try again") { Task { await app.bootstrap() } }.buttonStyle(.glassProminent)
                    }
                    .glassCard().padding()
                }
            case .signedIn:
                MainTabs()
            }
        }
        .animation(.smooth, value: phaseKey)
        .onChange(of: scenePhase) { _, new in
            if new == .active, case .signedIn = app.phase { Task { await app.refresh() } }
        }
    }

    private var phaseKey: Int {
        switch app.phase { case .launching: 0; case .signedOut: 1; case .offline: 2; case .signedIn: 3 }
    }
}

struct MainTabs: View {
    @Environment(AppState.self) private var app
    @State private var tab = UserDefaults.standard.integer(forKey: "debugTab")

    var body: some View {
        TabView(selection: $tab) {
            Tab("Timer", systemImage: "timer", value: 0) { TimerView() }
            Tab("Timesheet", systemImage: "calendar.day.timeline.left", value: 1) { TimesheetView() }
            if app.isManager {
                Tab("Review", systemImage: "checkmark.seal", value: 2) { ReviewView() }
            }
            Tab("Data", systemImage: "folder", value: 3) { DataView() }
            Tab("Account", systemImage: "person.crop.circle", value: 4) { AccountView() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory(isEnabled: app.timer != nil && tab != 0) { TimerAccessory() }
        .overlay(alignment: .top) {
            if let t = app.toast {
                Text(t).font(.subheadline.weight(.medium)).padding(.horizontal, 16).padding(.vertical, 10)
                    .glassEffect(.regular, in: .capsule)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task(id: t) { try? await Task.sleep(for: .seconds(2.6)); app.toast = nil }
            }
        }
        .animation(.smooth, value: app.toast)
    }
}
