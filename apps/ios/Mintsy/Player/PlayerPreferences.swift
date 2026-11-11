import Foundation

/// The viewer's player choices on this device (the Expo app kept the same ones in `src/lib/preferences.ts`).
/// Not sensitive, so UserDefaults.
struct PlayerPreferences {
    private static let voiceKey = "player.defaultVoiceID"
    private static let captionsKey = "player.captionsByDefault"
    private static let autoplayKey = "player.autoplayNext"

    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// The narrator last picked, used whenever an episode offers it.
    var defaultVoiceID: String? {
        get { defaults.string(forKey: Self.voiceKey) }
        nonmutating set { defaults.set(newValue, forKey: Self.voiceKey) }
    }

    /// Off by default, as in the Expo app.
    var captionsByDefault: Bool {
        defaults.bool(forKey: Self.captionsKey)
    }

    /// On by default, as in the Expo app.
    var autoplayNext: Bool {
        defaults.object(forKey: Self.autoplayKey) as? Bool ?? true
    }
}
