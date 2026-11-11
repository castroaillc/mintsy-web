import SwiftUI

/// The About tab: description and facts.
struct BookAboutView: View {
    let book: Book

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(book.description)
                .font(BrandFont.inter(15))
                .lineSpacing(5)
                .foregroundStyle(Palette.secondaryForeground)
            VStack(spacing: 0) {
                BookFactRow(label: "Author", value: "\(book.author)", showsDivider: false)
                BookFactRow(label: "Category", value: "\(book.category)")
                BookFactRow(label: "Episodes", value: "^[\(book.episodes.count) chapter](inflect: true), about 5 minutes each")
                BookFactRow(label: "Total runtime", value: "\(SeriesFormat.runtime(SeriesFormat.totalRuntime(book)))")
            }
            .padding(.horizontal, 16)
            .background(Palette.card, in: .rect(cornerRadius: 14))
            .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
        }
    }
}
