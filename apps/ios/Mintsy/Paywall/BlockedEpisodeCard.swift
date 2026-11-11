import SwiftUI

/// The episode the viewer was stopped at: "3 free episodes watched · Episode 4 of 20 · <title> is next".
struct BlockedEpisodeCard: View {
    let book: Book
    let episode: Episode

    @Environment(ProgressStore.self) private var progress

    var body: some View {
        let watched = book.episodes.count { !$0.locked && progress.entry(for: $0.id)?.completed == true }
        HStack(spacing: 14) {
            CoverTile(book: book, width: 44)
            VStack(alignment: .leading, spacing: 4) {
                Group {
                    if watched > 0 {
                        Text("^[\(watched) free episode](inflect: true) watched")
                    } else {
                        Text("First \(SharedConstants.freeEpisodes) episodes are free")
                    }
                }
                .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                .foregroundStyle(Palette.brand)
                Text("Episode \(episode.number) of \(book.episodes.count) · \(episode.title) is next")
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.foreground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(Palette.card, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
        .accessibilityElement(children: .combine)
    }
}
