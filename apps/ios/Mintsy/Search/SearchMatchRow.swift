import SwiftUI

/// An episode line that mentions the query: where it is, the episode title, and the line with the match marked.
struct SearchMatchRow: View {
    let match: SearchResults.Match

    var body: some View {
        let at = SeriesFormat.time(Double(match.hit.startSec))
        VStack(alignment: .leading, spacing: 5) {
            Text("\(match.episode.locked ? "Premium · " : "")\(match.book.title) · \(SeriesFormat.episodeLabel(match.episode, in: match.book)) · at \(at)")
                .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                .foregroundStyle(Palette.brand)
            Text(match.episode.title)
                .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                .foregroundStyle(Palette.foreground)
            Text(SnippetText.highlighted(match.hit))
                .font(BrandFont.inter(14, relativeTo: .subheadline))
                .foregroundStyle(Palette.mutedForeground)
        }
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Plays from this line")
    }
}
