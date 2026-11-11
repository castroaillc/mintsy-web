import SwiftUI

/// The signed-out entry point (design 4, Expo `(auth)/welcome.tsx`): the fan of covers, the pitch, Sign in with
/// Apple, Create account and Sign in. On a screen with room, the fan takes the height the rest leaves; when even
/// the rest doesn't fit (large text, a short window), the screen scrolls without the fan.
struct WelcomeView: View {
    let onCreateAccount: () -> Void
    let onSignIn: () -> Void

    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        ViewThatFits(in: .vertical) {
            WelcomeContent(showsFan: true, onCreateAccount: onCreateAccount, onSignIn: onSignIn)
            ScrollView {
                WelcomeContent(showsFan: false, onCreateAccount: onCreateAccount, onSignIn: onSignIn)
            }
        }
        .background(Palette.background)
        .toolbarVisibility(.hidden, for: .navigationBar)
        .task { await loadCatalog() }
    }

    /// The catalog is public: the fan shows real covers before sign-in.
    private func loadCatalog() async {
        if catalog.books.isEmpty { await catalog.load() }
    }
}
