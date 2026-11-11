import SwiftUI

/// "0:12  Line text", for transcript previews and blocks.
struct TimedLineView: View {
    let line: TranscriptLine

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(SeriesFormat.time(Double(line.startSec)))
                .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                .monospacedDigit()
                .foregroundStyle(Palette.brand)
                .frame(minWidth: 40, alignment: .leading)
            Text(line.text)
                .font(BrandFont.inter(14, relativeTo: .subheadline))
                .foregroundStyle(Palette.secondaryForeground)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}
