import SwiftUI

/// The change-email result, by outcome.
struct EmailChangedContent: View {
    let outcome: EmailChangeOutcome
    let onDone: () -> Void

    var body: some View {
        switch outcome {
        case .checking:
            AuthScreen(title: "Confirming your email", subtitle: "One moment…") {
                ProgressView()
                    .frame(maxWidth: .infinity)
            }
        case .changed(let email):
            AuthScreen(title: "Email updated", subtitle: "You’ll now sign in with \(email).") {
                Button("Done", action: onDone).buttonStyle(.brand(height: 54))
            }
        case .confirmed:
            AuthScreen(title: "Email confirmed", subtitle: "Sign in with your new email address.") {
                Button("Done", action: onDone).buttonStyle(.brand(height: 54))
            }
        case .failed(let message):
            AuthScreen(title: "Couldn’t change your email", subtitle: message) {
                Text("Your email hasn’t changed. Start again from Profile › Settings › Email to get a new link.")
                    .font(BrandFont.inter(15))
                    .foregroundStyle(Palette.mutedForeground)
                Button("Done", action: onDone).buttonStyle(.brand(height: 54))
            }
        }
    }
}
