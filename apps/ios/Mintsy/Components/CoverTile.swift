import SwiftUI

/// The book's rendered cover when it has one; otherwise a generated tile: solid tone, title in Space Grotesk, author
/// underneath. 2:3, like the Expo app's `CoverTile`.
struct CoverTile: View {
    let book: Book
    var width: Double = 124
    var showsEpisodeCount = false

    var body: some View {
        let preset = CoverTilePreset.forWidth(width)
        let ink = CoverInk.color(on: book.coverTone)
        ZStack(alignment: .topLeading) {
            Color(hex: book.coverTone) ?? Palette.card

            VStack(alignment: .leading) {
                Text(book.title)
                    .font(BrandFont.display(preset.title, relativeTo: .caption))
                    .lineLimit(preset.author > 0 ? 5 : 6)
                    .foregroundStyle(ink)
                Spacer(minLength: 0)
                if preset.author > 0 {
                    Text(book.author)
                        .font(BrandFont.inter(preset.author, .medium, relativeTo: .caption2))
                        .lineLimit(2)
                        .foregroundStyle(ink)
                }
            }
            .dynamicTypeSize(...DynamicTypeSize.large)
            .padding(.top, showsEpisodeCount ? 34 : preset.padV)
            .padding(.bottom, preset.padV)
            .padding(.horizontal, preset.padH)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if let url = book.coverUrl {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
            }

            if showsEpisodeCount {
                Text("^[\(book.episodes.count) episode](inflect: true)")
                    .font(BrandFont.inter(11, .semibold, relativeTo: .caption2))
                    .foregroundStyle(Palette.onScrim)
                    .padding(.horizontal, 7)
                    .frame(height: 20)
                    .background(Palette.scrim.opacity(0.8), in: .capsule)
                    .padding(8)
            }
        }
        .frame(width: width, height: (width * 1.5).rounded())
        .clipShape(.rect(cornerRadius: preset.radius))
        .shadow(color: .black.opacity(preset.hasShadow ? 0.45 : 0), radius: 18, y: 16)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(book.title) by \(book.author)")
    }
}

#if DEBUG
#Preview {
    HStack {
        CoverTile(book: .preview, width: 124, showsEpisodeCount: true)
        CoverTile(book: .preview, width: 150)
    }
    .padding()
    .background(Palette.background)
}
#endif
