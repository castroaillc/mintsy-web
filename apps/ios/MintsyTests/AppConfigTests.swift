import Foundation
import Testing
@testable import Mintsy

struct AppConfigTests {
    @Test func readsTheVariantsSettings() throws {
        let config = try AppConfig.load(from: [
            "MintsyVariant": "development",
            "MintsyAPIURL": "http://localhost:4000",
            "MintsyURLScheme": "mintsy-dev",
            "MintsyHLSEnabled": "NO",
        ])
        #expect(config.origin == "mintsy-dev://")
        #expect(config.graphQLURL.absoluteString == "http://localhost:4000/graphql")
        #expect(config.authURL.absoluteString == "http://localhost:4000/api/auth")
        #expect(!config.hlsEnabled)
    }

    @Test func aMissingAPIURLIsReported() {
        #expect(throws: AppConfigError.missingAPIURL(variant: "preview")) {
            try AppConfig.load(from: ["MintsyVariant": "preview", "MintsyAPIURL": "", "MintsyURLScheme": "mintsy-preview"])
        }
    }

    @Test func aURLWithoutHTTPIsRejected() {
        #expect(throws: AppConfigError.invalidAPIURL("localhost:4000")) {
            try AppConfig.load(from: ["MintsyAPIURL": "localhost:4000", "MintsyURLScheme": "mintsy-dev"])
        }
    }

    @Test func theAppBundleHasAUsableConfiguration() throws {
        // The test host is the Development build
        let config = try AppConfig.load(from: Bundle.main.infoDictionary ?? [:])
        #expect(config.variant == "development")
        #expect(config.urlScheme == "mintsy-dev")
    }
}
