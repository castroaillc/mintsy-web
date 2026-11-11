import SwiftUI

/// Step 4 (design 10): a first series, suggested from the interests. "Start Episode 1" finishes onboarding and opens
/// the episode; "Browse all series instead" finishes it on Home. This step can't be skipped.
struct FirstSeriesStepView: View {
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(CatalogStore.self) private var catalog
    @State private var selectedID: String?

    var body: some View {
        let picks = Recommender.picks(from: catalog.books, interests: onboarding.answers.interests)
        // Falls back to the top pick if a catalog refresh dropped the selected book
        let selected = (picks.first { $0.id == selectedID } ?? picks.first)?.book
        OnboardingShell(
            step: .firstSeries,
            title: "Start your first series",
            subtitle: "Picked from your interests. You can add more later.",
            showsFooterDivider: false
        ) {
            FirstSeriesPicks(picks: picks, selectedID: selected?.id, status: catalog.status, onSelect: select, onRetry: retry)
                .padding(.top, 24)
        } footer: {
            if let selected, let first = selected.episodes.first {
                Button {
                    start(first, in: selected)
                } label: {
                    Label("Start Episode 1", systemImage: "play.fill")
                }
                .buttonStyle(.brand(height: 54))
            }
            SecondaryActionButton(title: "Browse all series instead", action: browse)
        }
    }

    private func select(_ pick: Recommendation) {
        selectedID = pick.id
    }

    private func start(_ episode: Episode, in book: Book) {
        onboarding.complete(startEpisodeID: episode.id, bookID: book.id)
    }

    private func browse() {
        onboarding.complete()
    }

    private func retry() {
        Task { await catalog.load() }
    }
}
