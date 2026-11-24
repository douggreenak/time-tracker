import SwiftUI

// MARK: - Background

/// A slow-moving mesh gradient. Liquid Glass needs colour behind it to refract.
struct AuroraBackground: View {
    @Environment(\.colorScheme) private var scheme
    @State private var phase = false

    var body: some View {
        let dark = scheme == .dark
        let colors: [Color] = dark
            ? [Color(hex: 0x0B1228), Color(hex: 0x14214D), Color(hex: 0x0A1F3A),
               Color(hex: 0x16134A), Color(hex: 0x1F3C88), Color(hex: 0x0E3B4F),
               Color(hex: 0x0A0F26), Color(hex: 0x1B2A6B), Color(hex: 0x062C3A)]
            : [Color(hex: 0xDCE8FF), Color(hex: 0xC9D8FF), Color(hex: 0xD3F0F5),
               Color(hex: 0xE4DDFF), Color(hex: 0xB5CCFF), Color(hex: 0xC4EEF0),
               Color(hex: 0xF0F4FF), Color(hex: 0xCFE0FF), Color(hex: 0xDDF6F2)]
        let d: Float = phase ? 0.06 : -0.06
        MeshGradient(
            width: 3, height: 3,
            points: [
                [0, 0], [0.5, 0], [1, 0],
                [0, 0.5], [0.5 + d, 0.5 - d], [1, 0.5],
                [0, 1], [0.5, 1], [1, 1],
            ],
            colors: colors
        )
        .ignoresSafeArea()
        .onAppear { withAnimation(.easeInOut(duration: 9).repeatForever(autoreverses: true)) { phase = true } }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

// MARK: - Glass helpers

extension View {
    /// A padded Liquid Glass card.
    func glassCard(radius: CGFloat = 26, padding: CGFloat = 16, tint: Color? = nil) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(tint.map { .regular.tint($0.opacity(0.18)) } ?? .regular, in: .rect(cornerRadius: radius))
    }

    /// A recessed field for use *inside* a glass card (glass-on-glass looks muddy).
    func insetField(radius: CGFloat = 14) -> some View {
        self.padding(12).background(.fill.tertiary, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
    }

    /// Translucent rows for grouped lists, so the aurora shows through like glass.
    func glassRow() -> some View {
        self.listRowBackground(Rectangle().fill(.ultraThinMaterial))
    }

    func screenBackground() -> some View {
        self.scrollContentBackground(.hidden).background { AuroraBackground() }
    }
}

// MARK: - Status

struct StatusChip: View {
    let status: EntryStatus
    var flagged = false

    private var color: Color {
        if flagged { return .orange }
        switch status {
        case .draft: return .gray
        case .submitted: return .blue
        case .approved: return .green
        case .exported: return .purple
        }
    }

    var body: some View {
        Text(flagged ? "Question" : status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .foregroundStyle(color)
            .glassEffect(.regular.tint(color.opacity(0.22)), in: .capsule)
    }
}

struct RoleChip: View {
    let role: String
    var body: some View {
        Text(role.capitalized)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .glassEffect(.regular, in: .capsule)
    }
}

// MARK: - Pickers

struct Option: Identifiable, Hashable {
    let id: String
    let label: String
}

/// A glass row showing "Title … current value ⌄" that opens a menu.
struct OptionMenu: View {
    let title: String
    let icon: String
    @Binding var selection: String
    let options: [Option]
    var noneLabel: String? = "None"
    var disabled = false

    private var current: String {
        options.first { $0.id == selection }?.label ?? (noneLabel ?? "Choose")
    }

    var body: some View {
        Menu {
            if let noneLabel {
                Button { selection = "" } label: { if selection.isEmpty { Label(noneLabel, systemImage: "checkmark") } else { Text(noneLabel) } }
            }
            ForEach(options) { o in
                Button { selection = o.id } label: { if selection == o.id { Label(o.label, systemImage: "checkmark") } else { Text(o.label) } }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).frame(width: 22).foregroundStyle(.tint)
                Text(title).foregroundStyle(.primary)
                Spacer(minLength: 8)
                Text(current)
                    .foregroundStyle(selection.isEmpty ? .secondary : .primary)
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
        }
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }
}

struct ErrorBanner: View {
    let text: String
    var body: some View {
        Label(text, systemImage: "exclamationmark.triangle.fill")
            .font(.footnote.weight(.medium))
            .foregroundStyle(.red)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular.tint(.red.opacity(0.15)), in: .rect(cornerRadius: 16))
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 38, weight: .light)).foregroundStyle(.tint)
            Text(title).font(.headline)
            Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
    }
}
