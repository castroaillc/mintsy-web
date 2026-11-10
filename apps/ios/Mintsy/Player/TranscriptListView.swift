import SwiftUI

/// The transcript synced to playback: the active line raised, past lines muted, tap a line to jump there.
/// Each line's id is its index, which is how lines match across narrators.
struct TranscriptListView: View {
    let model: PlayerModel
    let isFollowing: Bool
    let onSeek: (Double) -> Void

    var body: some View {
        let active = model.activeLineIndex
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("Tap a line to jump there")
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
                Spacer()
                if isFollowing {
                    Label("Following along", systemImage: "arrow.down")
                        .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                        .foregroundStyle(Palette.brand)
                }
            }
            .padding(.horizontal, 8)
            .frame(minHeight: 36, alignment: .bottom)

            ForEach(Array(model.transcript.enumerated()), id: \.offset) { index, line in
                TranscriptLineRow(line: line, state: index == active ? .current : index < active ? .past : .upcoming) {
                    onSeek(Double(line.startSec))
                }
                .id(index)
            }
        }
        .padding(.horizontal, 12)
    }
}
