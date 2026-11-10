import SwiftUI

/// Home below the chips: loading, error, the featured series and rows, or an empty state.
struct HomeContent: View {
    let sections: HomeSections
    let status: CatalogStatus
    let query: String
    let category: String

    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        switch status {
        case .loading:
            HomeLoadingView()
        case .failed(let message):
            ContentUnavailableView {
                Label("Couldn’t load mintsy", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Try again", action: retry)
                    .buttonStyle(.brand(height: 44))
                    .frame(maxWidth: 240)
            }
            .padding(.top, 40)
        case .ready:
            if let featured = sections.featured {
                FeaturedSeriesCard(book: featured)
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 20)
            }
            ForEach(sections.rows) { row in
                BookRail(title: row.title, books: row.books)
                    .padding(.top, 32)
            }
            if sections.visible.isEmpty {
                HomeEmptyState(query: query, category: category)
            }
        }
    }

    private func retry() {
        Task { await catalog.load() }
    }
}
