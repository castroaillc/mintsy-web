import SwiftUI

/// Chooses between launch, the signed-out screens and the app by the session's state, and opens the links Better
/// Auth's emails bring back (reset password, email changed) over whichever is showing.
struct RootView: View {
    let dependencies: AppDependencies

    @State private var deepLink: DeepLink?

    var body: some View {
        let session = dependencies.session
        ZStack {
            Palette.background.ignoresSafeArea()

            switch session.state {
            case .restoring:
                LaunchView()
            case .signedOut:
                SignedOutFlow()
            case .signedIn(let user):
                MainTabView(user: user)
                    .task(id: user.id) { await loadAccount(userID: user.id) }
            case .restoreFailed(let message):
                RestoreFailedView(message: message)
            }
        }
        .environment(session)
        .environment(dependencies.catalog)
        .environment(dependencies.saved)
        .environment(dependencies.progress)
        .environment(dependencies.premium)
        .environment(\.graphQL, dependencies.graphQL)
        .environment(\.appConfig, dependencies.config)
        .task { await session.restore() }
        .onChange(of: session.state.user?.id) { _, userID in
            if userID == nil { forgetAccount() }
        }
        .onOpenURL(perform: open)
        .sheet(item: $deepLink) { link in
            DeepLinkSheet(link: link)
                .environment(session)
        }
    }

    /// Signed in (or switched account): the viewer's catalog (locks depend on Premium), My List, progress, and
    /// Premium, with whatever the App Store holds for the account handed to the API.
    private func loadAccount(userID: String) async {
        // Push registration is best-effort and must never delay catalog/premium load
        Task { await dependencies.push.register(graphQL: dependencies.graphQL, variant: dependencies.config.variant) }
        async let catalog: Void = dependencies.catalog.load()
        async let saved: Void = dependencies.saved.load()
        async let progress: Void = dependencies.progress.sync()
        async let premium: Void = dependencies.premium.setUser(userID)
        _ = await (catalog, saved, progress, premium)
    }

    /// Signed out or deleted: nothing of the last viewer's stays on screen, Premium included.
    private func forgetAccount() {
        Task { await dependencies.premium.setUser(nil) }
        dependencies.catalog.reset()
        dependencies.saved.reset()
        dependencies.progress.reset()
    }

    private func open(_ url: URL) {
        if let link = DeepLink(url: url, scheme: dependencies.config.urlScheme) {
            deepLink = link
        }
    }
}
