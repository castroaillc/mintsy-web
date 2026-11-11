import SwiftUI

/// One episode's whole transcript, on the Transcripts tab.
struct TranscriptBlockView: View {
    let book: Book
    let episode: Episode
    let onPlay: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(SeriesFormat.episodeLabel(episode, in: book))
                        .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                        .foregroundStyle(Palette.mutedForeground)
                    Text(episode.title)
                        .font(BrandFont.inter(16, .semibold, relativeTo: .headline))
                        .foregroundStyle(Palette.foreground)
                }
                Spacer()
                CircleIconButton(
                    title: episode.locked ? "Unlock \(episode.title) with Premium" : "Play \(episode.title)",
                    systemImage: episode.locked ? "lock.fill" : "play.fill",
                    variant: .surface,
                    iconSize: 15,
                    action: onPlay
                )
            }
            if episode.locked {
                Text("The transcript for this episode is part of Premium.")
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.mutedForeground)
            }
            // Transcript lines have no ids; they're a fixed list for this episode
            ForEach(Array(episode.transcript.enumerated()), id: \.offset) { _, line in
                TimedLineView(line: line)
            }
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.vertical, 20)
        .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
    }
}
