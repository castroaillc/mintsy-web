import SwiftUI

/// The search field, the filter chips and what's found.
struct SearchContent: View {
    @Bindable var model: SearchModel

    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                switch model.phase {
                case .idle:
                    SearchBrowseGrid(books: catalog.books)
                case .searching:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                        .accessibilityLabel("Searching")
                case .failed(let message):
                    ContentUnavailableView {
                        Label("Couldn’t search", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try again", action: retry)
                            .buttonStyle(.brand(height: 44))
                            .frame(maxWidth: 200)
                    }
                    .padding(.top, 40)
                case .done(let results):
                    if results.isEmpty {
                        ContentUnavailableView.search(text: results.query)
                            .padding(.top, 40)
                    } else {
                        SearchFilterBar(selection: $model.filter)
                            .padding(.bottom, 4)
                        SearchResultsList(results: results, filter: model.filter)
                    }
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.bottom, 32)
            .frame(maxWidth: Metrics.readableWidth)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.immediately)
        .searchable(text: $model.query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Books, authors, topics")
        .autocorrectionDisabled()
        .task(id: model.trimmedQuery) { await model.search(in: catalog) }
    }

    private func retry() {
        Task { await model.retry(in: catalog) }
    }
}
