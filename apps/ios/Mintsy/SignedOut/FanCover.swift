import SwiftUI

/// One cover of the fan: a placeholder while the catalog's first load runs.
struct FanCover: View {
    let book: Book
    let width: Double
    let isLoading: Bool

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Palette.surfaceRaised)
                .frame(width: width, height: (width * 1.5).rounded())
                .opacity(isLoading ? 1 : 0)
            CoverTile(book: book, width: width)
                .opacity(isLoading ? 0 : 1)
        }
        .animation(.easeOut(duration: 0.3), value: isLoading)
    }
}
