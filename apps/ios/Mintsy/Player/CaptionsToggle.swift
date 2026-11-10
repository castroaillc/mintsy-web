import SwiftUI

/// Shows or hides captions; outlined in the brand color while they're on.
struct CaptionsToggle: View {
    let model: PlayerModel

    var body: some View {
        CircleIconButton(
            title: model.captionsOn ? "Hide captions" : "Show captions",
            systemImage: model.captionsOn ? "captions.bubble.fill" : "captions.bubble",
            action: toggle
        )
        .overlay {
            if model.captionsOn { Circle().strokeBorder(Palette.brand, lineWidth: 2) }
        }
        .accessibilityAddTraits(model.captionsOn ? .isSelected : [])
    }

    private func toggle() {
        model.setCaptions(!model.captionsOn)
        model.showControls()
    }
}
