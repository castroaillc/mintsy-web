import SwiftUI

/// Series strip: one segment per episode, the current one in the foreground color.
struct SegmentedProgress: View {
    let count: Int
    let currentIndex: Int

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(index == currentIndex ? Palette.foreground : Palette.input)
                    .frame(height: 4)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Episode \(currentIndex + 1) of \(count)")
    }
}
