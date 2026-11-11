import SwiftUI

/// Opened by the change-email confirmation link (`<scheme>://email-changed`, or `?error=CODE`). Refreshes the
/// session so the new address shows everywhere (Expo `email-changed.tsx`).
struct EmailChangedView: View {
    let errorCode: String?

    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var outcome = EmailChangeOutcome.checking

    var body: some View {
        EmailChangedContent(outcome: outcome, onDone: close)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: close)
                }
            }
            .task { await check() }
    }

    private func check() async {
        if let errorCode {
            outcome = .failed(EmailChangeOutcome.message(for: errorCode))
            return
        }
        try? await session.refreshUser()
        outcome = session.state.user.map { .changed($0.email) } ?? .confirmed
    }

    private func close() {
        dismiss()
    }
}
