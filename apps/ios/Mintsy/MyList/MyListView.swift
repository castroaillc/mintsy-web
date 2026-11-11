import SwiftUI

/// My List (design 37): saved series and episodes, series in progress, and finished series.
struct MyListView: View {
    @Binding var segment: MyListSegment
    let onBrowse: () -> Void

    @Environment(CatalogStore.self) private var catalog
    @Environment(SavedStore.self) private var saved
    @Environment(ProgressStore.self) private var progress

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Section", selection: $segment) {
                        ForEach(MyListSegment.allCases) { segment in
                            Text(segment.title).tag(segment)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch segment {
                    case .saved:
                        SavedList(onBrowse: onBrowse)
                    case .inProgress:
                        InProgressList(items: progress.continueWatching(in: catalog), isLoading: !progress.loaded && catalog.books.isEmpty)
                    case .finished:
                        FinishedList(books: progress.finishedBooks(in: catalog), isLoading: !progress.loaded && catalog.books.isEmpty)
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 8)
                .padding(.bottom, 32)
                .frame(maxWidth: Metrics.readableWidth)
                .frame(maxWidth: .infinity)
            }
            .background(Palette.background)
            .navigationTitle("My List")
            .navigationDestination(for: BookRoute.self) { route in
                BookScreen(bookID: route.bookID)
            }
            .refreshable { await reload() }
        }
    }

    private func reload() async {
        async let lists: Void = saved.load()
        async let places: Void = progress.sync()
        async let books: Void = catalog.load()
        _ = await (lists, places, books)
    }
}
