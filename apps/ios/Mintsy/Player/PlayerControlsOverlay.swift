import SwiftUI

/// Over the video: close, captions and full screen along the top; −10, play and +10 bottom right; the scrubber
/// along the bottom.
struct PlayerControlsOverlay: View {
    let model: PlayerModel
    @Binding var isFullScreen: Bool
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                CircleIconButton(title: "Close player", systemImage: "chevron.down", iconSize: 20, action: onClose)
                Spacer()
                CaptionsToggle(model: model)
                CircleIconButton(
                    title: isFullScreen ? "Exit full screen" : "Full screen",
                    systemImage: isFullScreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right",
                    action: toggleFullScreen
                )
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)

            Spacer(minLength: 0)

            if model.hasStream {
                HStack(spacing: 14) {
                    CircleIconButton(title: "Back 10 seconds", systemImage: "gobackward.10", action: back)
                    CircleIconButton(
                        title: model.engine.isPlaying ? "Pause" : "Play",
                        systemImage: model.engine.isPlaying ? "pause.fill" : "play.fill",
                        variant: .brand,
                        size: 60,
                        iconSize: 22,
                        action: togglePlay
                    )
                    CircleIconButton(title: "Forward 10 seconds", systemImage: "goforward.10", action: forward)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.trailing, 20)

                PlayerScrubber(model: model)
                    .padding(.horizontal, 16)
            }
        }
    }

    private func toggleFullScreen() {
        isFullScreen.toggle()
        model.showControls()
    }

    private func togglePlay() {
        model.engine.togglePlay()
        model.showControls()
    }

    private func back() {
        model.seek(to: model.engine.positionSec - 10)
        model.showControls()
    }

    private func forward() {
        model.seek(to: model.engine.positionSec + 10)
        model.showControls()
    }
}
