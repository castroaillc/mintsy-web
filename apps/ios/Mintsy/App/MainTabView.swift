import SwiftUI

/// Home, Search, My List and Profile. The player covers the tabs, as the Expo app's full-screen modal did.
struct MainTabView: View {
    let user: AuthUser

    @Environment(SavedStore.self) private var saved
    @Environment(ProgressStore.self) private var progress
    @Environment(\.scenePhase) private var scenePhase
    @State private var selection: AppTab = .home
    @State private var homePath: [BookRoute] = []
    @State private var myListSegment: MyListSegment = .saved
    @State private var player = PlayerPresenter()

    var body: some View {
        @Bindable var saved = saved
        TabView(selection: $selection) {
            Tab("Home", systemImage: "house", value: .home) {
                NavigationStack(path: $homePath) {
                    HomeView(user: user, onOpenProfile: openProfile)
                        .navigationDestination(for: BookRoute.self) { route in
                            BookScreen(bookID: route.bookID)
                        }
                }
            }
            Tab("Search", systemImage: "magnifyingglass", value: .search) {
                SearchView()
            }
            Tab("My List", systemImage: "bookmark", value: .myList) {
                MyListView(segment: $myListSegment, onBrowse: openHome)
            }
            Tab("Profile", systemImage: "person", value: .profile) {
                ProfileView(user: user, onOpenMyList: openMyList)
            }
        }
        .environment(player)
        .fullScreenCover(item: $player.route) { route in
            PlayerScreen(route: route)
                .environment(player)
        }
        .fullScreenCover(item: $player.paywall, onDismiss: player.paywallDismissed) { route in
            PaywallFlow(route: route, onClose: player.closePaywall, onPlay: player.playAfterPaywall, onHome: player.goHome)
        }
        .alert(saved.failure?.title ?? "", item: $saved.failure) { _ in
            Button("OK", role: .cancel) {}
        } message: { failure in
            Text(failure.message)
        }
        .onChange(of: scenePhase) { _, phase in
            sceneChanged(to: phase)
        }
        .onChange(of: player.homeRequests) {
            homePath = []
            selection = .home
        }
    }

    private func openProfile() {
        selection = .profile
    }

    private func openHome() {
        selection = .home
    }

    private func openMyList(_ segment: MyListSegment) {
        myListSegment = segment
        selection = .myList
    }

    /// Leaving the app sends unsent progress; coming back reloads it (it may have moved on another device).
    private func sceneChanged(to phase: ScenePhase) {
        switch phase {
        case .active:
            Task { await progress.sync() }
        case .background:
            progress.saveNow()
        default:
            break
        }
    }
}
