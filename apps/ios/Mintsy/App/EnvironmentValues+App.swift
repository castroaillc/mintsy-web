import SwiftUI

extension EnvironmentValues {
    /// The API client, for screens that make their own requests (the player's `episodeVoices`).
    @Entry var graphQL: GraphQLClient?
    @Entry var appConfig: AppConfig?
}
