import SwiftUI

/// The build can't run: its configuration is missing a value. Developers only ever see this.
struct ConfigErrorView: View {
    let error: AppConfigError

    var body: some View {
        ContentUnavailableView {
            Label("This build isn’t configured", systemImage: "gearshape.2")
        } description: {
            Text(error.description)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
    }
}
