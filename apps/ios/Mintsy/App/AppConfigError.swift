import Foundation

/// Why the build's configuration can't be used. Shown on screen instead of the app.
nonisolated enum AppConfigError: Error, Equatable, CustomStringConvertible {
    case missingAPIURL(variant: String)
    case invalidAPIURL(String)
    case missingURLScheme

    var description: String {
        switch self {
        case .missingAPIURL(let variant):
            "No API URL is set for the \(variant) variant. Copy Config/API.xcconfig.example to Config/API.xcconfig and fill it in."
        case .invalidAPIURL(let value):
            "The API URL “\(value)” isn't a valid http or https URL."
        case .missingURLScheme:
            "The build has no URL scheme (MINTSY_URL_SCHEME)."
        }
    }
}
