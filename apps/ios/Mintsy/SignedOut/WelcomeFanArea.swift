import SwiftUI

/// Whatever height Welcome's column leaves, with the fan scaled to fit it. Its ideal height is zero, so it never
/// pushes the buttons off screen; below `minimumScale` the fan isn't drawn.
struct WelcomeFanArea: View {
    static let minimumScale = 0.4

    @Environment(CatalogStore.self) private var catalog
    @State private var scale = 0.0

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, minHeight: 0, idealHeight: 0, maxHeight: .infinity)
            .onGeometryChange(for: Double.self) { proxy in
                min(1, proxy.size.height / CoverFan.size.height, proxy.size.width / CoverFan.size.width)
            } action: { scale = $0 }
            .overlay {
                CoverFan(covers: WelcomeCovers(books: catalog.books), isLoading: catalog.status == .loading && catalog.books.isEmpty)
                    .scaleEffect(scale)
                    .opacity(scale >= Self.minimumScale ? 1 : 0)
            }
    }
}
