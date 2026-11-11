import SwiftUI

/// "Resend link", then "Sent again · resend in 30s" counting down (design 46).
struct ResendButton: View {
    let isResending: Bool
    let resentAt: ContinuousClock.Instant?
    let cooldown: Duration
    let action: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let remaining = resentAt.map { cooldown - (ContinuousClock.now - $0) } ?? .zero
            let seconds = Int(max(0, remaining.components.seconds))
            Button(action: action) {
                ZStack {
                    Text(seconds > 0 ? "Sent again · resend in \(seconds)s" : "Resend link")
                        .opacity(isResending ? 0 : 1)
                    ProgressView().opacity(isResending ? 1 : 0)
                }
            }
            .buttonStyle(.brand(.outline, height: 54))
            .disabled(isResending || seconds > 0)
        }
    }
}
