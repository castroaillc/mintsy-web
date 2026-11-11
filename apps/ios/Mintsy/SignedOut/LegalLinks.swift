import Foundation

/// Where Terms and Privacy live. Apple's standard EULA serves as mintsy's Terms of Use (as in the Expo app).
nonisolated enum LegalLinks {
    static let terms = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://getmintsy.com/privacy")!
    static let support = URL(string: "https://getmintsy.com/support")!
}
