import SwiftUI

struct TimerView: View {
    @Environment(AppState.self) private var app

    @State private var customerId = ""
    @State private var jobId = ""
    @State private var serviceId = ""
    @State private var location: LocationKind = .on_site
    @State private var notes = ""
    @State private var busy = false
    @State private var error: String?
    @State private var confirmDiscard = false
    @State private var synced = false
    @State private var editing: EntryDraft?

    private var running: Bool { app.timer?.isRunning == true }
    private var hasTimer: Bool { app.timer != nil }
    private var jobs: [Option] {
        (app.customer(customerId)?.jobs ?? []).filter(\.isActive).map { Option(id: $0.id, label: $0.name) }
    }
    private var todays: [TimeEntry] { app.myEntries.filter { $0.date == Fmt.today } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    clockCard
                    controls
                    if let error { ErrorBanner(text: error) }
                    detailsCard
                    todayCard
                }
                .padding(.horizontal, 16).padding(.bottom, 30)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await app.refresh() }
            .background { AuroraBackground() }
            .screenHeader("Timer") {
                Button { editing = EntryDraft(userId: app.me?.id ?? "") } label: { Label("Add time", systemImage: "plus") }
            }
            .sheet(item: $editing) { d in EntryEditor(draft: d) }
        }
        .onAppear(perform: syncFromTimer)
        .onChange(of: app.timer == nil) { _, _ in syncFromTimer() }
        .onChange(of: customerId) { _, _ in if !jobs.contains(where: { $0.id == jobId }) { jobId = "" }; pushUpdate() }
        .onChange(of: jobId) { _, _ in pushUpdate() }
        .onChange(of: serviceId) { _, _ in pushUpdate() }
        .onChange(of: location) { _, _ in pushUpdate() }
        .task(id: notes) {
            guard hasTimer, synced else { return }
            try? await Task.sleep(for: .milliseconds(700))
            if !Task.isCancelled { pushUpdate() }
        }
        .confirmationDialog("Discard this timer?", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("Discard without saving", role: .destructive) { run { try await app.discardTimer() } }
        } message: { Text("The elapsed time won't be saved.") }
    }

    // MARK: Pieces

    private var clockCard: some View {
        VStack(spacing: 6) {
            ClockText(running: running)
                .font(.system(size: 64, weight: .semibold, design: .rounded))
                .minimumScaleFactor(0.6).lineLimit(1)
            HStack(spacing: 6) {
                Circle().fill(running ? .green : (hasTimer ? .orange : .gray)).frame(width: 8, height: 8)
                Text(running ? "Running" : (hasTimer ? "Paused" : "Ready")).font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 34)
        .glassEffect(running ? .regular.tint(.green.opacity(0.18)) : .regular, in: .rect(cornerRadius: 40))
        .animation(.smooth, value: running)
    }

    private var controls: some View {
        GlassEffectContainer(spacing: 14) {
            AdaptiveStack(spacing: 14) {
                if !hasTimer {
                    Button { run { try await app.startTimer(customerId: customerId, jobId: jobId, serviceId: serviceId, location: location, notes: notes) } } label: {
                        Label("Start", systemImage: "play.fill").frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.glassProminent)
                } else {
                    Button { run { running ? try await app.pauseTimer() : try await app.resumeTimer() } } label: {
                        Label(running ? "Pause" : "Resume", systemImage: running ? "pause.fill" : "play.fill").frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.glass)
                    Button {
                        run {
                            if try await app.stopTimer() != nil { app.toast = "Saved to your timesheet as a draft" }
                            resetFields()
                        }
                    } label: {
                        Label("Stop", systemImage: "stop.fill").frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.glassProminent).tint(.red)
                }
            }
            .controlSize(.large)
            .disabled(busy)
        }
        .overlay(alignment: .bottomTrailing) {
            if hasTimer {
                Button("Discard", role: .destructive) { confirmDiscard = true }
                    .font(.footnote).buttonStyle(.plain).foregroundStyle(.red).offset(y: 26)
            }
        }
        .padding(.bottom, hasTimer ? 18 : 0)
    }

    private var detailsCard: some View {
        VStack(spacing: 14) {
            OptionMenu(title: "Customer", icon: "building.2", selection: $customerId,
                       options: app.activeCustomers.map { Option(id: $0.id, label: $0.name) })
            Divider()
            OptionMenu(title: "Project", icon: "square.stack.3d.up", selection: $jobId, options: jobs, disabled: customerId.isEmpty)
            Divider()
            OptionMenu(title: "Task", icon: "wrench.and.screwdriver", selection: $serviceId,
                       options: app.activeServices.map { Option(id: $0.id, label: $0.name) })
            Divider()
            Picker("Location", selection: $location) {
                ForEach(LocationKind.allCases) { Label($0.label, systemImage: $0.icon).tag($0) }
            }
            .pickerStyle(.segmented)
            TextField("Notes", text: $notes, axis: .vertical)
                .lineLimit(1...4)
                .insetField()
        }
        .glassCard()
    }

    private var todayCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Today").font(.headline)
                Spacer()
                Text(Fmt.duration(todays.reduce(0) { $0 + $1.durationMinutes })).font(.headline).foregroundStyle(.tint)
            }
            if todays.isEmpty {
                Text("Nothing logged yet today.").font(.subheadline).foregroundStyle(.secondary)
            } else {
                ForEach(todays) { e in
                    Button { editing = EntryDraft(e) } label: { EntryRow(entry: e, compact: true) }.buttonStyle(.plain)
                    if e.id != todays.last?.id { Divider() }
                }
            }
        }
        .glassCard()
    }

    // MARK: Logic

    private func syncFromTimer() {
        if let t = app.timer {
            customerId = t.customerId ?? ""
            jobId = t.jobId ?? ""
            serviceId = t.serviceItemId ?? ""
            location = LocationKind(rawValue: t.locationType) ?? .on_site
            notes = t.notes ?? ""
        }
        DispatchQueue.main.async { synced = true }
    }

    private func resetFields() { customerId = ""; jobId = ""; serviceId = ""; notes = "" }

    private func pushUpdate() {
        guard hasTimer, synced else { return }
        Task { await app.updateTimer(customerId: customerId, jobId: jobId, serviceId: serviceId, location: location, notes: notes) }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        busy = true; error = nil
        Task {
            defer { busy = false }
            do { try await work() } catch { self.error = error.localizedDescription; await app.handle(error) }
        }
    }
}

/// Compact running-timer pill shown above the tab bar on other tabs.
struct TimerAccessory: View {
    @Environment(AppState.self) private var app
    var open: () -> Void = {}
    var body: some View {
        Button(action: open) {
            HStack(spacing: 10) {
                Image(systemName: app.timer?.isRunning == true ? "timer" : "pause.circle").foregroundStyle(.tint)
                ClockText(running: app.timer?.isRunning == true).font(.headline)
                Spacer()
                Text(app.timer?.isRunning == true ? "Running" : "Paused").font(.caption).foregroundStyle(.secondary)
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the timer")
    }
}

/// The elapsed-time readout. It only schedules once-a-second redraws while the timer is actually running;
/// paused or idle it is a plain static Text, so the screen can sleep and the CPU stays idle.
struct ClockText: View {
    @Environment(AppState.self) private var app
    let running: Bool

    var body: some View {
        Group {
            if running {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Text(Fmt.clock(app.elapsedSeconds(at: ctx.date)))
                }
            } else {
                Text(Fmt.clock(app.elapsedSeconds()))
            }
        }
        .monospacedDigit()
        .contentTransition(.numericText())
    }
}
