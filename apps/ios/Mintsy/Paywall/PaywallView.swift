import SwiftUI

/// The Premium paywall (design 18, Expo `paywall.tsx`). Makes its model from the Premium store and loads the plans.
struct PaywallView: View {
    let route: PaywallRoute
    let onClose: () -> Void
    let onSubscribed: () -> Void

    @Environment(PremiumStore.self) private var premium
    @State private var model: PaywallModel?

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    PaywallContent(model: model, episodeID: route.episodeID, onClose: onClose, onSubscribed: onSubscribed)
                } else {
                    Palette.background.ignoresSafeArea()
                }
            }
            .toolbarTitleDisplayMode(.inline)
        }
        .task { await start() }
    }

    private func start() async {
        guard model == nil else { return }
        let model = PaywallModel(premium: premium)
        self.model = model
        if await model.load() { onSubscribed() }
    }
}

#if DEBUG
#Preview {
    PaywallView(route: PaywallRoute(episodeID: "preview-book-4"), onClose: {}, onSubscribed: {})
        .environment(PremiumStore.preview)
        .environment(CatalogStore.preview)
        .environment(ProgressStore(client: .preview))
        .preferredColorScheme(.dark)
}
#endif
