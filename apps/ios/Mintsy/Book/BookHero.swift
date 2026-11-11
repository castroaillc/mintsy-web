import SwiftUI

/// The book's tint, edge to edge and under the status bar, with the cover.
struct BookHero: View {
    let book: Book

    var body: some View {
        CoverTile(book: book, width: 150)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, minHeight: 330, alignment: .bottom)
            .background {
                (Color(hex: book.tint) ?? Palette.card)
                    .ignoresSafeArea(edges: .top)
            }
    }
}
