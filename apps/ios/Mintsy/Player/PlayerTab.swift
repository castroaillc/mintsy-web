import Foundation

/// The tabs under the player.
enum PlayerTab: String, CaseIterable, Identifiable, CustomStringConvertible {
    case transcript, takeaways

    var id: Self { self }

    var description: String {
        switch self {
        case .transcript: "Transcript"
        case .takeaways: "Key takeaways"
        }
    }
}
