import SwiftUI

/// Previous · speed · narrator · Next, under the episode's title.
struct PlayerControlRow: View {
    let model: PlayerModel
    let onSelectEpisode: (Episode) -> Void

    var body: some View {
        let previous = model.previousEpisode
        let next = model.nextEpisode
        HStack(spacing: model.voiceOptions.count > 1 ? 6 : 8) {
            Button("Previous episode", systemImage: "backward.end.fill") {
                if let previous { onSelectEpisode(previous) }
            }
            .labelStyle(.iconOnly)
            .buttonStyle(.controlChip)
            .disabled(previous == nil)

            Button(action: model.engine.cycleSpeed) {
                Text("\(model.engine.speed.formatted(.number.precision(.fractionLength(0...2))))×")
                    .monospacedDigit()
            }
            .buttonStyle(.controlChip)
            .accessibilityLabel("Playback speed \(model.engine.speed.formatted(.number.precision(.fractionLength(0...2)))) times")
            .disabled(!model.hasStream)

            if model.voiceOptions.count > 1 {
                NarratorMenu(model: model)
            }

            Spacer(minLength: 0)

            Button {
                if let next { onSelectEpisode(next) }
            } label: {
                Label("Next", systemImage: "forward.end.fill")
                    .labelStyle(TrailingIconLabelStyle())
                    .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                    .foregroundStyle(Palette.background)
                    .padding(.horizontal, 14)
                    .frame(minHeight: Metrics.minTap)
                    .background(Palette.foreground, in: .rect(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(next == nil)
            .opacity(next == nil ? 0.4 : 1)
            .accessibilityLabel("Next episode")
        }
    }
}
