import SwiftUI

/// The first lines of an episode's transcript, with Play and Read transcript.
struct EpisodePreviewCard: View {
    let label: String
    let episode: Episode
    let onPlay: () -> Void
    let onReadTranscript: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Transcript preview")
                    .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                    .textCase(.uppercase)
                    .kerning(1.2)
                Spacer()
                Text(label)
                    .font(BrandFont.inter(12, relativeTo: .caption))
            }
            .foregroundStyle(Palette.mutedForeground)

            // Locked episodes come without a transcript; the summary stands in for the preview
            if episode.locked {
                Text(episode.summary)
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.secondaryForeground)
            }
            ForEach(Array(episode.transcript.prefix(3).enumerated()), id: \.offset) { _, line in
                TimedLineView(line: line)
            }

            HStack(spacing: 8) {
                Button(action: onPlay) {
                    Label(episode.locked ? "Unlock with Premium" : "Play episode", systemImage: "play.fill")
                }
                .buttonStyle(.brand(height: 44))
                Button("Read transcript", action: onReadTranscript)
                    .buttonStyle(.brand(.outline, height: 44))
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(Palette.card, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
    }
}
