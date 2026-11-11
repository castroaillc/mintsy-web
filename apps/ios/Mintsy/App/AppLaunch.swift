import Foundation

/// The app's dependencies, or why the build can't run.
enum AppLaunch {
    case ready(AppDependencies)
    case misconfigured(AppConfigError)

    static func fromMainBundle() -> AppLaunch {
        let info = Bundle.main.infoDictionary ?? [:]
        do {
            let config = try AppConfig.load(from: info)
            return .ready(AppDependencies(config: config, keychainService: Bundle.main.bundleIdentifier ?? "com.getmintsy.app"))
        } catch {
            return .misconfigured(error)
        }
    }
}
