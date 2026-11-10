import Foundation

/// The GraphQL documents the app sends, matching the Expo app's (`src/lib/catalog-query.ts`, `src/lib/voices.ts`).
nonisolated enum CatalogQueries {
    /// The whole catalog. `hlsUrl` is only in the text when HLS is on: an API without the field would reject the
    /// whole request at validation, and the viewer would lose every book.
    static func books(hlsEnabled: Bool) -> String {
        """
        query Books {
          books {
            id
            title
            author
            category
            coverTone
            coverUrl
            tint
            description
            episodes {
              id
              number
              title
              summary
              durationSec
              transcript { startSec text }
              takeaways
              videoUrl
              \(hlsEnabled ? "hlsUrl" : "")
              thumbnailUrl
              locked
            }
          }
        }
        """
    }

    /// One episode's narrators. Separate from the catalog: the timed text is heavy, and an API without
    /// `episodeVoices` fails this request alone.
    static let episodeVoices = """
        query EpisodeVoices($episodeId: ID!) {
          episodeVoices(episodeId: $episodeId) {
            id
            name
            isDefault
            videoUrl
            hlsUrl
            durationSec
            transcript { startSec text }
            captions { startSec endSec text }
          }
        }
        """
}
