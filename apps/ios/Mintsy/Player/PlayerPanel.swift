import SwiftUI

/// The video on the book's tint, with captions, the buffering spinner and the fading controls.
struct PlayerPanel: View {
    let model: PlayerModel
    @Binding var isFullScreen: Bool
    let onClose: () -> Void

    var body: some View {
        ZStack {
            (Color(hex: model.book.tint) ?? Palette.card)
                .ignoresSafeArea()

            if model.hasStream {
                VideoSurface(player: model.engine.player)
                    .ignoresSafeArea(edges: isFullScreen ? .all : [])
            }

            // Tapping the picture shows or hides the controls. VoiceOver reaches everything through the controls,
            // which stay up while it's on.
            Button(action: model.toggleControls) {
                Color.clear.contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHidden(true)

            PanelTopText(model: model)
                .padding(.horizontal, 24)
                .padding(.top, 70)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .allowsHitTesting(false)

            if let caption = model.activeCaption {
                TimedCaptionView(text: caption.text, isRaised: model.controlsVisible)
                    .padding(.horizontal, 8)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .allowsHitTesting(false)
            }

            if model.engine.isBuffering {
                ProgressView()
                    .tint(Palette.onScrim)
                    .frame(width: 44, height: 44)
                    .background(Palette.scrim.opacity(0.6), in: .circle)
                    .allowsHitTesting(false)
                    .accessibilityLabel("Loading")
            }

            PlayerControlsOverlay(model: model, isFullScreen: $isFullScreen, onClose: onClose)
                .opacity(model.controlsVisible ? 1 : 0)
                .allowsHitTesting(model.controlsVisible)
                .accessibilityHidden(!model.controlsVisible)
                .animation(.easeInOut(duration: model.controlsVisible ? 0.18 : 0.15), value: model.controlsVisible)
        }
        .clipped()
        .environment(\.colorScheme, .dark)
    }
}
