import Foundation

/// A link from one of Better Auth's emails, after the API redirected it to the app's scheme:
/// `<scheme>://reset-password?token=…` (or `?error=INVALID_TOKEN`) and `<scheme>://email-changed` (or `?error=CODE`).
/// The Expo app also saw them with a slash before the query (`reset-password/?token=`), so both forms are read.
nonisolated enum DeepLink: Equatable, Sendable, Identifiable {
    static let resetPasswordHost = "reset-password"
    static let emailChangedHost = "email-changed"

    case resetPassword(token: String?, error: String?)
    case emailChanged(error: String?)

    var id: String {
        switch self {
        case .resetPassword(let token, let error): "reset:\(token ?? ""):\(error ?? "")"
        case .emailChanged(let error): "email:\(error ?? "")"
        }
    }

    /// The link, if `url` is one for this build (its own scheme) that the app handles.
    init?(url: URL, scheme: String) {
        guard url.scheme?.lowercased() == scheme.lowercased(),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        // `scheme://reset-password` puts the name in the host; `scheme:reset-password` in the path
        let path = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let name = (components.host?.isEmpty == false ? components.host : nil) ?? path
        let query = components.queryItems ?? []
        func value(_ key: String) -> String? {
            query.first { $0.name == key }?.value.flatMap { $0.isEmpty ? nil : $0 }
        }
        switch name.lowercased() {
        case Self.resetPasswordHost:
            self = .resetPassword(token: value("token"), error: value("error"))
        case Self.emailChangedHost:
            self = .emailChanged(error: value("error"))
        default:
            return nil
        }
    }
}
