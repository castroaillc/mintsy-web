import SwiftUI

/// The phone player (design 3): the video panel with its controls, then the episode, controls, Transcript and Key
/// takeaways, and Up next. Full screen hides everything below the panel.
struct PlayerView: View {
    let model: PlayerModel
    let onSelectEpisode: (Episode) -> Void
    let onClose: () -> Void

    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @State private var isFullScreen = false

    var body: some View {
        VStack(spacing: 0) {
            PlayerPanel(model: model, isFullScreen: $isFullScreen, onClose: onClose)
                .frame(maxHeight: isFullScreen ? .infinity : 260)
                .ignoresSafeArea(edges: isFullScreen ? .all : [])

            if !isFullScreen {
                PlayerDetails(model: model, onSelectEpisode: onSelectEpisode)
            }
        }
        .background(Palette.background)
        .statusBarHidden(isFullScreen)
        .onChange(of: voiceOverEnabled, initial: true) { _, enabled in
            model.isVoiceOverRunning = enabled
        }
    }
}
