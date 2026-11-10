import SwiftUI

/// Chooses between launch, sign-in and the app by the session's state.
struct RootView: View {
    let dependencies: AppDependencies

    var body: some View {
        let session = dependencies.session
        ZStack {
            Palette.background.ignoresSafeArea()

            switch session.state {
            case .restoring:
                LaunchView()
            case .signedOut:
                SignInView()
            case .signedIn(let user):
                MainTabView(user: user)
                    .task(id: user.id) { await dependencies.catalog.load() }
            case .restoreFailed(let message):
                RestoreFailedView(message: message)
            }
        }
        .environment(session)
        .environment(dependencies.catalog)
        .environment(\.graphQL, dependencies.graphQL)
        .environment(\.appConfig, dependencies.config)
        .task { await session.restore() }
        .onChange(of: session.state.user == nil) { _, signedOut in
            if signedOut { dependencies.catalog.reset() }
        }
    }
}
