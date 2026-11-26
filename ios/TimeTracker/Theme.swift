import SwiftUI

// MARK: - Background

/// User-adjustable background: off (plain), or a static mesh gradient whose intensity runs from plain black / white
/// (0) through the original look (0.4) to very colourful and bright (1). Static, so it costs no CPU or battery.
struct AuroraBackground: View {
    @Environment(\.colorScheme) private var scheme
    @AppStorage(BackgroundSettings.enabledKey) private var enabled = true
    @AppStorage(BackgroundSettings.intensityKey) private var intensity = BackgroundSettings.defaultIntensity

    var body: some View {
        if enabled {
            MeshGradient(
                width: 3, height: 3,
                points: [
                    [0, 0], [0.5, 0], [1, 0],
                    [0, 0.5], [0.54, 0.46], [1, 0.5],
                    [0, 1], [0.5, 1], [1, 1],
                ],
                colors: BackgroundSettings.colors(dark: scheme == .dark, intensity: intensity)
            )
            .ignoresSafeArea()
        } else {
            (scheme == .dark ? Color.black : Color.white).ignoresSafeArea()
        }
    }
}

enum BackgroundSettings {
    static let enabledKey = "bgEnabled"
    static let intensityKey = "bgIntensity"
    static let defaultIntensity = 0.4

    private static let darkBase: UInt32 = 0x000000
    private static let darkMid: [UInt32] = [0x0B1228, 0x14214D, 0x0A1F3A, 0x16134A, 0x1F3C88, 0x0E3B4F, 0x0A0F26, 0x1B2A6B, 0x062C3A]
    private static let darkVivid: [UInt32] = [0x4527C8, 0x1E5FE0, 0x0097A7, 0xAD1FA0, 0x3652E8, 0x00A58E, 0x7B1FA2, 0x2563EB, 0xD81B60]
    private static let lightBase: UInt32 = 0xFFFFFF
    private static let lightMid: [UInt32] = [0xDCE8FF, 0xC9D8FF, 0xD3F0F5, 0xE4DDFF, 0xB5CCFF, 0xC4EEF0, 0xF0F4FF, 0xCFE0FF, 0xDDF6F2]
    private static let lightVivid: [UInt32] = [0x7FB2FF, 0xB48CFF, 0x5FE0D0, 0xFF9ED0, 0x5C9DFF, 0x8CF0C8, 0xFFD27F, 0x9AB8FF, 0xFF8FA8]

    static func colors(dark: Bool, intensity: Double) -> [Color] {
        let t = min(max(intensity, 0), 1)
        let base = dark ? darkBase : lightBase
        let mid = dark ? darkMid : lightMid
        let vivid = dark ? darkVivid : lightVivid
        let split = defaultIntensity
        return (0..<9).map { i in
            t <= split ? mix(base, mid[i], t / split) : mix(mid[i], vivid[i], (t - split) / (1 - split))
        }
    }

    private static func mix(_ a: UInt32, _ b: UInt32, _ f: Double) -> Color {
        func c(_ v: UInt32, _ shift: UInt32) -> Double { Double((v >> shift) & 0xFF) / 255 }
        return Color(red: c(a, 16) + (c(b, 16) - c(a, 16)) * f,
                     green: c(a, 8) + (c(b, 8) - c(a, 8)) * f,
                     blue: c(a, 0) + (c(b, 0) - c(a, 0)) * f)
    }
}

extension Color {
    /// Fill for prominent buttons: deep enough that white labels stay readable in light and dark mode (the accent colour is a light blue in dark mode, for text and icons).
    static let buttonBlue = Color(hex: 0x1D4ED8)
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

    /// A light-weight card for rows that repeat in long lists. Real Liquid Glass is reserved for chrome and
    /// hero elements: dozens of live glass layers while scrolling is the main GPU/battery cost.
    func rowCard(radius: CGFloat = 20, padding: CGFloat = 12) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(.white.opacity(0.12), lineWidth: 0.5))
    }

    /// One header for every page: the title on the left and the page's buttons on the right, on the same line.
    func screenHeader<T: View>(_ title: String, @ViewBuilder buttons: () -> T = { EmptyView() }) -> some View {
        let trailing = buttons()
        return self.toolbar(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) {
                HStack(spacing: 10) {
                    Text(title).font(.largeTitle.bold()).lineLimit(1).minimumScaleFactor(0.6)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 8)
                    GlassEffectContainer(spacing: 10) {
                        HStack(spacing: 10) { trailing }
                            .labelStyle(.iconOnly)
                            .buttonStyle(.glass)
                            .buttonBorderShape(.circle)
                            .controlSize(.large)
                    }
                }
                .frame(minHeight: 52)
                .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 10)
            }
    }

    func screenBackground() -> some View {
        self.scrollContentBackground(.hidden).background { AuroraBackground() }
    }
}

// MARK: - Status

struct StatusChip: View {
    let status: EntryStatus

    private var color: Color {
        switch status {
        case .open: .gray
        case .held: .orange
        case .invoiced: .purple
        }
    }

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .foregroundStyle(color)
            .background(color.opacity(0.18), in: Capsule())
    }
}

struct RoleChip: View {
    let role: String
    var body: some View {
        Text(role.capitalized)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(.fill.tertiary, in: Capsule())
    }
}

// MARK: - Pickers

struct Option: Identifiable, Hashable {
    let id: String
    let label: String
}

/// A glass row showing "Title … current value ⌄" that opens a menu.
/// Lays children out in a row, or a column at accessibility text sizes so nothing gets squeezed.
struct AdaptiveStack<Content: View>: View {
    @Environment(\.dynamicTypeSize) private var size
    var spacing: CGFloat = 12
    var alignment: HorizontalAlignment = .leading
    @ViewBuilder var content: () -> Content
    var body: some View {
        let layout = size.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: alignment, spacing: spacing))
            : AnyLayout(HStackLayout(spacing: spacing))
        layout { content() }
    }
}

struct OptionMenu: View {
    @Environment(\.dynamicTypeSize) private var size
    let title: String
    let icon: String
    @Binding var selection: String
    let options: [Option]
    var noneLabel: String? = "None"
    var disabled = false
    var addTitle: String? = nil
    var onAdd: (() -> Void)? = nil

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
            if let onAdd {
                Divider()
                Button(action: onAdd) { Label(addTitle ?? "Add new…", systemImage: "plus") }
            }
        } label: {
            let big = size.isAccessibilitySize
            HStack(spacing: 12) {
                Image(systemName: icon).frame(width: 22).foregroundStyle(.tint)
                if big {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).foregroundStyle(.primary)
                        Text(current).foregroundStyle(selection.isEmpty ? .secondary : .primary)
                    }
                    Spacer(minLength: 8)
                } else {
                    Text(title).foregroundStyle(.primary)
                    Spacer(minLength: 8)
                    Text(current)
                        .foregroundStyle(selection.isEmpty ? .secondary : .primary)
                        .lineLimit(1)
                }
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
