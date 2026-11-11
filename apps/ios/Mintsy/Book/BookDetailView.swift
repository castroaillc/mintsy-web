import SwiftUI

/// Book / series page (design 2): hero, facts, play button, then Episodes, Transcripts and About.
struct BookDetailView: View {
    let book: Book

    @Environment(PlayerPresenter.self) private var player
    @Environment(ProgressStore.self) private var progress
    @State private var tab: BookTab = .episodes
    @State private var rangeStart = 0
    @State private var expandedEpisodeID: String?
    @State private var scrollTarget: String?

    var body: some View {
        let range = Array(book.episodes.dropFirst(rangeStart).prefix(Metrics.episodeRange))
        let start = ProgressLogic.playStart(book, progress.progress)
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    BookHero(book: book)
                    BookSummary(book: book, start: start, watched: ProgressLogic.watchedCount(book, progress.progress), onPlay: playNext)
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.top, 22)
                    UnderlineTabs(tabs: BookTab.allCases, selection: $tab)
                        .padding(.top, 26)

                    if tab != .about {
                        EpisodeRangeBar(book: book, rangeStart: $rangeStart)
                            .padding(.horizontal, Metrics.gutter)
                            .padding(.top, 18)
                            .padding(.bottom, 6)
                    }

                    switch tab {
                    case .episodes:
                        ForEach(range) { episode in
                            EpisodeRowView(
                                book: book,
                                episode: episode,
                                entry: progress.entry(for: episode.id),
                                isExpanded: expandedEpisodeID == episode.id,
                                onToggle: { toggle(episode) },
                                onPlay: { player.open(episode) },
                                onReadTranscript: { readTranscript(of: episode) }
                            )
                        }
                    case .transcripts:
                        ForEach(range) { episode in
                            TranscriptBlockView(book: book, episode: episode) { player.open(episode) }
                                .id(episode.id)
                        }
                    case .about:
                        BookAboutView(book: book)
                            .padding(.horizontal, Metrics.gutter)
                            .padding(.top, 20)
                    }
                }
                .padding(.bottom, 48)
            }
            .onChange(of: scrollTarget) { _, target in
                guard let target else { return }
                withAnimation { proxy.scrollTo(target, anchor: .top) }
                scrollTarget = nil
            }
        }
        .background(Palette.background)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: "\(book.title) by \(book.author) on mintsy") {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        // The latest from the API: episodes may have been watched on another device
        .task(id: book.id) { await progress.refreshBook(book.id) }
    }

    /// The episode in progress (Resume), else the first one not watched.
    private func playNext() {
        if let start = ProgressLogic.playStart(book, progress.progress) { player.open(start.episode) }
    }

    private func toggle(_ episode: Episode) {
        expandedEpisodeID = expandedEpisodeID == episode.id ? nil : episode.id
    }

    private func readTranscript(of episode: Episode) {
        if episode.locked {
            player.open(episode)
            return
        }
        tab = .transcripts
        scrollTarget = episode.id
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookDetailView(book: .preview)
    }
    .environment(PlayerPresenter())
    .environment(ProgressStore(client: .preview))
    .environment(SavedStore(client: .preview))
    .preferredColorScheme(.dark)
}
#endif
