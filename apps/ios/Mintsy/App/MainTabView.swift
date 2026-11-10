import SwiftUI

/// Home, Search, My List and Profile. The player covers the tabs, as the Expo app's full-screen modal did.
struct MainTabView: View {
    let user: AuthUser

    @State private var selection: AppTab = .home
    @State private var homePath: [BookRoute] = []
    @State private var player = PlayerPresenter()

    var body: some View {
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
                SearchPlaceholderView()
            }
            Tab("My List", systemImage: "bookmark", value: .myList) {
                MyListPlaceholderView()
            }
            Tab("Profile", systemImage: "person", value: .profile) {
                ProfileView(user: user)
            }
        }
        .environment(player)
        .fullScreenCover(item: $player.route) { route in
            PlayerScreen(route: route)
                .environment(player)
        }
        .alert("Premium episode", item: $player.lockedEpisode) { _ in
            Button("OK", role: .cancel) {}
        } message: { episode in
            Text("Episode \(episode.number) is part of Premium. Subscribing isn’t in the native app yet.")
        }
    }

    private func openProfile() {
        selection = .profile
    }
}
