import SwiftUI

/// A session is stored, but the API couldn't say whose it is (offline at first launch after sign-in).
struct RestoreFailedView: View {
    let message: String
    @Environment(SessionStore.self) private var session

    var body: some View {
        ContentUnavailableView {
            Label("Couldn’t load mintsy", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("Try again", action: retry)
                .buttonStyle(.brand(height: 48))
                .frame(maxWidth: 280)
            Button("Sign out", action: signOut)
                .buttonStyle(.brand(.outline, height: 44))
                .frame(maxWidth: 280)
        }
    }

    private func retry() {
        Task { await session.restore() }
    }

    private func signOut() {
        Task { await session.signOut() }
    }
}
