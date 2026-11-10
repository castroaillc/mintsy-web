import AVKit
import SwiftUI

/// The video, through AVKit's player view controller with its own controls off (the app draws the Expo player's
/// controls over it). Letterboxing is clear, so the book's tint shows around the picture.
struct VideoSurface: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.showsPlaybackControls = false
        controller.videoGravity = .resizeAspect
        controller.allowsPictureInPicturePlayback = false
        controller.view.backgroundColor = .clear
        controller.player = player
        return controller
    }

    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {
        if controller.player !== player { controller.player = player }
    }
}
