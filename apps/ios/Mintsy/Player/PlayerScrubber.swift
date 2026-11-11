import SwiftUI

/// Seek bar with the current time and duration. Dragging holds the controls up and seeks on release.
struct PlayerScrubber: View {
    let model: PlayerModel

    @State private var value: Double = 0
    @State private var isDragging = false

    var body: some View {
        let engine = model.engine
        let duration = max(engine.durationSec, 1)
        VStack(spacing: 2) {
            Slider(value: $value, in: 0...duration, onEditingChanged: editingChanged)
                .tint(Palette.brand)
                .accessibilityLabel("Seek")
                .accessibilityValue("\(SeriesFormat.time(value)) of \(SeriesFormat.time(duration))")

            HStack {
                Text(SeriesFormat.time(value))
                Spacer()
                Text(SeriesFormat.time(duration))
            }
            .font(BrandFont.inter(12, .medium, relativeTo: .caption))
            .monospacedDigit()
            .foregroundStyle(Palette.onScrim)
            .accessibilityHidden(true)
        }
        .padding(.bottom, 4)
        .onChange(of: engine.positionSec, initial: true) { _, position in
            if !isDragging { value = min(position, duration) }
        }
    }

    private func editingChanged(_ editing: Bool) {
        isDragging = editing
        model.isScrubbing = editing
        if !editing { model.seek(to: value) }
    }
}
