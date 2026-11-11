import Foundation

extension Bundle {
    /// "1.0.0 (1)": the marketing version and build.
    nonisolated var shortVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "\(version) (\(build))"
    }
}
