import SwiftUI

@main
struct TimeTrackerApp: App {
    @State private var app = AppState()
    @State private var tracker = LocationTracker()
    @State private var places = PlacesModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(tracker)
                .environment(places)
                .task {
                    #if DEBUG
                    if UserDefaults.standard.bool(forKey: "seedPlaces") { tracker.seedDemo(); tracker.enable() }
                    #endif
                    tracker.resumeIfNeeded()
                    #if DEBUG
                    if UserDefaults.standard.bool(forKey: "resetSession") { APIClient.shared.clearSession() }
                    #endif
                    await app.bootstrap()
                    if case .signedIn = app.phase { await tracker.syncNow(); await places.load() }
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
    @Environment(LocationTracker.self) private var tracker
    @Environment(PlacesModel.self) private var places

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
                        Button("Try again") { Task { await app.bootstrap() } }.buttonStyle(.glassProminent).tint(.buttonBlue)
                    }
                    .glassCard().padding()
                }
            case .signedIn:
                ZStack {
                    AuroraBackground()
                    MainTabs().frame(maxWidth: 760)
                }
            }
        }
        .animation(.smooth, value: phaseKey)
        .onChange(of: scenePhase) { _, new in
            if new == .active { tracker.resumeIfNeeded() }
            if new == .background { tracker.flush(); Task { await tracker.syncNow() } }
            if new == .active, case .signedIn = app.phase { Task { await app.refresh(minAge: 60); await tracker.syncNow(); await places.load() } }
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
            Tab("Places", systemImage: "mappin.and.ellipse", value: 5) { PlacesView() }
            Tab("Customers", systemImage: "building.2", value: 3) { DataView() }
            Tab("Account", systemImage: "person.crop.circle", value: 4) { AccountView() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .onChange(of: app.requestedTab) { _, t in if let t { tab = t; app.requestedTab = nil } }
        .tabViewBottomAccessory(isEnabled: app.timer != nil && tab != 0) { TimerAccessory { withAnimation { tab = 0 } } }
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
        .safeAreaInset(edge: .top, spacing: 0) {
            if let problem = app.syncError { SyncBanner(message: problem) }
        }
        .animation(.smooth, value: app.syncError)
    }
}

/// Shown on every tab while the last sync failed, so empty or old lists are never mistaken for the truth.
struct SyncBanner: View {
    @Environment(AppState.self) private var app
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "wifi.exclamationmark").foregroundStyle(.red)
            VStack(alignment: .leading, spacing: 2) {
                Text("Not up to date").font(.footnote.weight(.semibold))
                Text(message).font(.footnote).foregroundStyle(.secondary)
                if let t = app.lastSynced { Text("Last updated \(t.formatted(.relative(presentation: .named)))").font(.caption2).foregroundStyle(.secondary) }
            }
            Spacer(minLength: 8)
            Button(app.loadingEntries ? "Trying…" : "Retry") { Task { await app.refresh() } }
                .buttonStyle(.glassProminent).tint(.buttonBlue).controlSize(.small).disabled(app.loadingEntries)
        }
        .padding(12)
        .glassEffect(.regular.tint(.red.opacity(0.18)), in: .rect(cornerRadius: 18))
        .padding(.horizontal, 12).padding(.top, 4)
        .accessibilityElement(children: .combine)
    }
}
