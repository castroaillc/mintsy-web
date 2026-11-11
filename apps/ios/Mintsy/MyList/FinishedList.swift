import SwiftUI

/// My List › Finished: series with every episode watched, most recently finished first.
struct FinishedList: View {
    let books: [Book]
    let isLoading: Bool

    @Environment(PlayerPresenter.self) private var player

    var body: some View {
        if isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 240)
        } else if books.isEmpty {
            ContentUnavailableView(
                "No finished series yet",
                systemImage: "checkmark.seal",
                description: Text("Watch every episode of a series and it shows up here.")
            )
            .padding(.top, 40)
        } else {
            LazyVStack(alignment: .leading, spacing: 10) {
                Text("^[\(books.count) finished series](inflect: true)")
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
                ForEach(books) { book in
                    FinishedBookRow(book: book) { watchAgain(book) }
                }
            }
        }
    }

    /// Starts the series over from episode 1.
    private func watchAgain(_ book: Book) {
        if let first = book.episodes.first { player.open(first) }
    }
}
