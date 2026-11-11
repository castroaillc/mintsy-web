import SwiftUI

/// Welcome to Premium (design 19, Expo `premium-welcome.tsx`), after a purchase or a restore.
struct PremiumWelcomeView: View {
    /// The episode the viewer was blocked on, if any.
    let episodeID: String?
    let onPlay: (Episode) -> Void
    let onHome: () -> Void
    let onClose: () -> Void

    @Environment(CatalogStore.self) private var catalog
    @Environment(PremiumStore.self) private var premium
    @State private var viewportHeight: Double = 0

    private static let longDate = Date.FormatStyle.dateTime.month(.wide).day().year()

    var body: some View {
        // Only offered once the API has unlocked it
        let next = episodeID.flatMap(catalog.episode(id:)).flatMap { $0.episode.locked ? nil : $0 }
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: 18) {
                    PremiumMark()
                    Text("You’re Premium")
                        .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                        .textCase(.uppercase)
                        .kerning(1.4)
                        .foregroundStyle(Palette.brand)
                    Text("Every episode is unlocked.")
                        .font(BrandFont.display(32, relativeTo: .largeTitle))
                        .foregroundStyle(Palette.foreground)
                        .accessibilityAddTraits(.isHeader)
                    message
                        .font(BrandFont.inter(16))
                        .lineSpacing(4)
                        .foregroundStyle(Palette.mutedForeground)
                        .frame(maxWidth: 300)
                }
                .multilineTextAlignment(.center)
                .padding(.vertical, 24)
                .frame(maxHeight: .infinity)

                if let next {
                    UpNextCard(book: next.book, episode: next.episode) { onPlay(next.episode) }
                    Button {
                        onPlay(next.episode)
                    } label: {
                        Label("Play Episode \(next.episode.number)", systemImage: "play.fill")
                    }
                    .buttonStyle(.brand(height: 56))
                    .padding(.top, 16)
                    Button("Go to Home", action: onHome)
                        .font(BrandFont.inter(15, .medium, relativeTo: .subheadline))
                        .foregroundStyle(Palette.mutedForeground)
                        .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
                        .contentShape(.rect)
                        .buttonStyle(.plain)
                        .padding(.top, 6)
                } else {
                    Button("Start watching", action: onClose)
                        .buttonStyle(.brand(height: 56))
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 32)
            .frame(maxWidth: 480, minHeight: viewportHeight)
            .frame(maxWidth: .infinity)
        }
        .onGeometryChange(for: Double.self) { $0.size.height } action: { viewportHeight = $0 }
        .scrollBounceBehavior(.basedOnSize)
        .background(Palette.background)
    }

    /// When the trial or the paid period ends, from the API's state. No dates are promised that it didn't give.
    private var message: Text {
        switch premium.premium.status {
        case .trial(let ends):
            Text("Your free trial runs until \(ends, format: Self.longDate).")
        case .active(let renews?):
            Text("Your plan renews on \(renews, format: Self.longDate).")
        case .ending(let date):
            Text("Your plan runs until \(date, format: Self.longDate).")
        case .active(nil), nil:
            Text("Every series, every transcript, every takeaway.")
        }
    }
}

#if DEBUG
#Preview {
    PremiumWelcomeView(episodeID: "preview-book-1", onPlay: { _ in }, onHome: {}, onClose: {})
        .environment(CatalogStore.preview)
        .environment(PremiumStore.preview)
        .preferredColorScheme(.dark)
}
#endif
