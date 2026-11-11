import SwiftUI

/// Books that match, then episodes that mention the query (the first few, then Show all).
struct SearchResultsList: View {
    /// Episode matches shown before "Show all".
    static let initialMatches = 6

    let results: SearchResults
    let filter: SearchFilter

    @Environment(PlayerPresenter.self) private var player
    @State private var showsAllMatches = false

    var body: some View {
        let matches = showsAllMatches ? results.matches : Array(results.matches.prefix(Self.initialMatches))
        LazyVStack(alignment: .leading, spacing: 0) {
            if filter != .episodes, !results.books.isEmpty {
                SearchSectionTitle(text: "Books · \(results.books.count)")
                VStack(spacing: 10) {
                    ForEach(results.books) { book in
                        NavigationLink(value: BookRoute(bookID: book.id)) {
                            SearchBookRow(book: book)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            if filter != .books, !results.matches.isEmpty {
                SearchSectionTitle(text: "Episodes that mention “\(results.query)” · \(results.matches.count)")
                ForEach(matches) { match in
                    Button { player.open(match.episode, at: Double(match.hit.startSec)) } label: {
                        SearchMatchRow(match: match)
                    }
                    .buttonStyle(.plain)
                }
                if !showsAllMatches, results.matches.count > Self.initialMatches {
                    Button("Show all \(results.matches.count) episodes", action: showAll)
                        .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(Palette.secondaryForeground)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
            }
            if (filter == .books && results.books.isEmpty) || (filter == .episodes && results.matches.isEmpty) {
                ContentUnavailableView.search(text: results.query)
                    .padding(.top, 24)
            }
        }
        .onChange(of: results.query) { showsAllMatches = false }
    }

    private func showAll() {
        showsAllMatches = true
    }
}
