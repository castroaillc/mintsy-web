import SwiftUI

/// One line in the player's transcript.
struct TranscriptLineRow: View {
    enum LineState { case past, current, upcoming }

    let line: TranscriptLine
    let state: LineState
    let onSeek: () -> Void

    var body: some View {
        Button(action: onSeek) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(SeriesFormat.time(Double(line.startSec)))
                    .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                    .monospacedDigit()
                    .foregroundStyle(state == .current ? Palette.brand : Palette.faint)
                    .frame(minWidth: 40, alignment: .leading)
                Text(line.text)
                    .font(BrandFont.inter(16, state == .current ? .semibold : .regular))
                    .lineSpacing(4)
                    .foregroundStyle(textColor)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 12)
            .background(state == .current ? Palette.tag : .clear, in: .rect(cornerRadius: 12))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(state == .current ? .isSelected : [])
        .accessibilityHint("Jumps playback to this line")
    }

    private var textColor: Color {
        switch state {
        case .current: Palette.foreground
        case .past: Palette.faint
        case .upcoming: Palette.secondaryForeground
        }
    }
}
