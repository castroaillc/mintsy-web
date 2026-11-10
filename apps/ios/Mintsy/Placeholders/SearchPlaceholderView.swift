import SwiftUI

/// Search tab: not in the native app yet. Home filters the catalog in the meantime.
struct SearchPlaceholderView: View {
    var body: some View {
        NotBuiltYetView(
            title: "Search",
            systemImage: "magnifyingglass",
            detail: "Searching books and transcripts comes in a later milestone. The search field on Home filters books by title, author and category."
        )
    }
}
