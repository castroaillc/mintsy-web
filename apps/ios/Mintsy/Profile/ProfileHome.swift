import SwiftUI

/// The Profile tab's first screen.
struct ProfileHome: View {
    let user: AuthUser
    let onEdit: () -> Void
    let onOpenMyList: (MyListSegment) -> Void

    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress
    @Environment(SavedStore.self) private var saved

    var body: some View {
        let inProgress = progress.continueWatching(in: catalog)
        let finished = progress.finishedBooks(in: catalog)
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                ProfileIdentity(user: user, onEdit: onEdit)

                if !inProgress.isEmpty {
                    ProfileInProgressSection(items: Array(inProgress.prefix(3)), progress: progress.progress) {
                        onOpenMyList(.inProgress)
                    }
                }

                ProfileLinksCard(
                    savedCount: saved.bookIDs.count + saved.episodeIDs.count,
                    finishedCount: finished.count,
                    onOpenMyList: onOpenMyList
                )
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 8)
            .padding(.bottom, 32)
            .frame(maxWidth: Metrics.readableWidth)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.background)
        .navigationTitle("Profile")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink(value: ProfileRoute.settings) {
                    Label("Settings", systemImage: "gearshape")
                }
            }
        }
        .refreshable { await progress.sync() }
    }
}
