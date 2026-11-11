import Foundation

/// A My List change the API turned down, worded for an alert (the Expo app's messages).
nonisolated struct SavedFailure: Equatable, Sendable, Identifiable {
    let title: String
    let message: String

    var id: String { title + message }

    init(saving: Bool, error: APIError) {
        title = saving ? "Couldn’t save" : "Couldn’t remove"
        let reason = if case .graphQL(let graphQL) = error { graphQL.message } else { "" }
        message = if reason.localizedStandardContains("full") {
            "My List is full. Remove something to make room."
        } else if reason.localizedStandardContains("unknown id") {
            "This isn’t available anymore."
        } else {
            "We couldn’t update My List. Check your connection and try again."
        }
    }
}
