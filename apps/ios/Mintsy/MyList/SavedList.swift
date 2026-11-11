import SwiftUI

/// My List › Saved: series, then episodes, most recently saved first. Ids no longer in the catalog are left out.
struct SavedList: View {
    let onBrowse: () -> Void

    @Environment(CatalogStore.self) private var catalog
    @Environment(SavedStore.self) private var saved
    @Environment(ProgressStore.self) private var progress
    @Environment(PlayerPresenter.self) private var player

    var body: some View {
        let books = saved.bookIDs.compactMap(catalog.book(id:))
        let episodes = saved.episodeIDs.compactMap(catalog.episode(id:)).map { SavedEpisode(book: $0.book, episode: $0.episode) }
        if !saved.loaded || (catalog.status == .loading && catalog.books.isEmpty) {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 240)
        } else if books.isEmpty && episodes.isEmpty {
            ContentUnavailableView {
                Label("Nothing saved yet", systemImage: "bookmark")
            } description: {
                Text("Tap Save on any series to keep it here for later.")
            } actions: {
                Button("Browse series", action: onBrowse)
                    .buttonStyle(.brand(height: 48))
                    .frame(maxWidth: 220)
            }
            .padding(.top, 40)
        } else {
            LazyVStack(alignment: .leading, spacing: 10) {
                if !books.isEmpty {
                    Text("^[\(books.count) saved series](inflect: true)")
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .foregroundStyle(Palette.mutedForeground)
                    ForEach(books) { book in
                        SavedBookRow(book: book) { saved.toggle(.book, book.id) }
                    }
                }
                if !episodes.isEmpty {
                    Text("^[\(episodes.count) saved episode](inflect: true)")
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .foregroundStyle(Palette.mutedForeground)
                        .padding(.top, books.isEmpty ? 0 : 14)
                    ForEach(episodes) { item in
                        SavedEpisodeRow(item: item, entry: progress.entry(for: item.episode.id), onOpen: { player.open(item.episode) }) {
                            saved.toggle(.episode, item.episode.id)
                        }
                    }
                }
            }
        }
    }
}
