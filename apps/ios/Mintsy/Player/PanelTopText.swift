import SwiftUI

/// Along the top of the panel: the transcript line when captions are on without timed phrases, or the chapter
/// title when there's no video.
struct PanelTopText: View {
    let model: PlayerModel

    var body: some View {
        if model.showsTranscriptOverlay, model.transcript.indices.contains(model.activeLineIndex) {
            Text(model.transcript[model.activeLineIndex].text)
                .font(BrandFont.inter(15, .medium, relativeTo: .callout))
                .foregroundStyle(Palette.onScrim)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Palette.scrim.opacity(0.8), in: .rect(cornerRadius: 6))
                .accessibilityAddTraits(.updatesFrequently)
        } else if !model.hasStream {
            VStack(alignment: .leading, spacing: 8) {
                Text("Chapter \(model.episode.number)")
                    .font(BrandFont.display(13, relativeTo: .caption))
                    .textCase(.uppercase)
                    .kerning(1.4)
                    .foregroundStyle(Palette.onTint.opacity(0.85))
                Text(model.episode.title)
                    .font(BrandFont.display(30, relativeTo: .title))
                    .lineLimit(3)
                    .foregroundStyle(Palette.onTint)
                    .frame(maxWidth: 250, alignment: .leading)
                Text("The video for this episode isn’t available yet.")
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.onTint.opacity(0.85))
            }
        }
    }
}
