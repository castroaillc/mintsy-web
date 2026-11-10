import SwiftUI

@main
struct MintsyApp: App {
    @State private var launch = AppLaunch.fromMainBundle()

    var body: some Scene {
        WindowGroup {
            Group {
                switch launch {
                case .ready(let dependencies):
                    RootView(dependencies: dependencies)
                case .misconfigured(let error):
                    ConfigErrorView(error: error)
                }
            }
            // Dark, as the Expo app's default was; the color sets also carry light values for later
            .preferredColorScheme(.dark)
            .tint(Palette.brand)
        }
    }
}
