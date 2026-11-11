import SwiftUI

/// An episode in the list. Tapping expands a transcript preview with Play and Read transcript.
struct EpisodeRowView: View {
    let book: Book
    let episode: Episode
    let entry: EpisodeProgress?
    let isExpanded: Bool
    let onToggle: () -> Void
    let onPlay: () -> Void
    let onReadTranscript: () -> Void

    var body: some View {
        let label = SeriesFormat.episodeLabel(episode, in: book)
        let status = ProgressLogic.status(entry)
        let meta = episode.locked ? "Premium · \(label)" : status == .watched ? "\(label) · Watched" : label
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggle) {
                HStack(alignment: .top, spacing: 14) {
                    EpisodeThumb(episode: episode, locked: episode.locked, progress: status == .unwatched ? nil : ProgressLogic.fraction(episode, entry))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(meta)
                            .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                            .foregroundStyle(Palette.mutedForeground)
                            .lineLimit(1)
                        Text(episode.title)
                            .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                            .foregroundStyle(Palette.foreground)
                            .lineLimit(2)
                        Text(episode.summary)
                            .font(BrandFont.inter(13, relativeTo: .footnote))
                            .foregroundStyle(Palette.mutedForeground)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                }
                .padding(.vertical, 14)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(meta). \(episode.title). \(episode.summary)")
            .accessibilityHint(isExpanded ? "Collapses the transcript preview" : "Shows a transcript preview")

            if isExpanded {
                EpisodePreviewCard(
                    label: label,
                    episode: episode,
                    onPlay: onPlay,
                    onReadTranscript: onReadTranscript
                )
                .padding(.bottom, 16)
            }
        }
        .padding(.horizontal, Metrics.gutter)
        .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
    }
}
