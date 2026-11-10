import SwiftUI

/// The next episode, under the transcript.
struct UpNextCard: View {
    let book: Book
    let episode: Episode
    let onSelect: () -> Void

    var body: some View {
        let label = SeriesFormat.episodeLabel(episode, in: book)
        Button(action: onSelect) {
            HStack(spacing: 14) {
                EpisodeThumb(episode: episode, size: .small, locked: episode.locked)
                VStack(alignment: .leading, spacing: 3) {
                    Text(episode.locked ? "Premium · \(label)" : label)
                        .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                        .foregroundStyle(Palette.mutedForeground)
                    Text(episode.title)
                        .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .background(Palette.card, in: .rect(cornerRadius: 14))
            .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
            .contentShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Up next: \(episode.locked ? "Premium, " : "")\(label), \(episode.title)")
    }
}
