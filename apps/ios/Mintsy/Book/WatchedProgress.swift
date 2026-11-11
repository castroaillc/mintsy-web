import SwiftUI

/// "3 of 12 episodes watched" with a bar.
struct WatchedProgress: View {
    let watched: Int
    let total: Int

    var body: some View {
        let fraction = total > 0 ? Double(watched) / Double(total) : 0
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(watched) of ^[\(total) episode](inflect: true) watched")
                    .foregroundStyle(Palette.secondaryForeground)
                Spacer()
                Text(fraction, format: .percent.precision(.fractionLength(0)))
                    .foregroundStyle(Palette.mutedForeground)
            }
            .font(BrandFont.inter(13, relativeTo: .footnote))
            ProgressBar(value: fraction, height: 6)
        }
        .accessibilityElement(children: .combine)
    }
}
