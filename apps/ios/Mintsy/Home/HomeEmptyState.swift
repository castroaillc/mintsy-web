import SwiftUI

/// Nothing matches the search or category.
struct HomeEmptyState: View {
    let query: String
    let category: String

    var body: some View {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        ContentUnavailableView {
            Text("Nothing here yet")
                .font(BrandFont.display(18, relativeTo: .headline))
        } description: {
            if trimmed.isEmpty {
                Text("We haven’t added any \(category) series yet.")
            } else if category == HomeSections.allCategories {
                Text("No books match “\(trimmed)”.")
            } else {
                Text("No books match “\(trimmed)” in \(category).")
            }
        }
        .padding(.top, 40)
    }
}
