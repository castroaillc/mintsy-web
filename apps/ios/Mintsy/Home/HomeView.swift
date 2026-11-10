import SwiftUI

/// Browse (design 1): wordmark, search, category chips, the featured series and rows of covers.
struct HomeView: View {
    let user: AuthUser
    let onOpenProfile: () -> Void

    @Environment(CatalogStore.self) private var catalog
    @State private var query = ""
    @State private var category = HomeSections.allCategories

    var body: some View {
        let sections = HomeSections(books: catalog.books, query: query, category: category)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HomeHeader(user: user, onOpenProfile: onOpenProfile)
                HomeSearchField(query: $query)
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 4)
                CategoryChipRow(selection: $category)
                    .padding(.top, 16)

                HomeContent(sections: sections, status: catalog.status, query: query, category: category)
            }
            .padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.immediately)
        .background(Palette.background)
        .refreshable { await catalog.load() }
        .toolbarVisibility(.hidden, for: .navigationBar)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        HomeView(user: .preview, onOpenProfile: {})
    }
    .environment(CatalogStore.preview)
    .environment(PlayerPresenter())
    .preferredColorScheme(.dark)
}
#endif
