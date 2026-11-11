import SwiftUI

/// Search (design 35): books by title, author or category, and episodes whose transcript mentions the query, from
/// the backend's `search`. Before a query, the whole catalog to browse, as the Expo tab showed.
struct SearchView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.graphQL) private var graphQL
    @State private var model: SearchModel?

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    SearchContent(model: model)
                } else {
                    Color.clear
                }
            }
            .background(Palette.background)
            .navigationTitle("Search")
            .navigationDestination(for: BookRoute.self) { route in
                BookScreen(bookID: route.bookID)
            }
        }
        .task { makeModel() }
    }

    private func makeModel() {
        if model == nil { model = SearchModel(client: graphQL) }
    }
}
