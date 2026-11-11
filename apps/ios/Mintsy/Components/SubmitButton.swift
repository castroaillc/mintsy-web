import SwiftUI

/// A form's main button: its title, or a spinner while the request runs.
struct SubmitButton: View {
    let title: String
    let isBusy: Bool
    var variant: BrandButtonStyle.Variant = .brand
    var height: Double = 54
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(isBusy ? 0 : 1)
                ProgressView()
                    .tint(variant == .outline ? Palette.foreground : Palette.brandForeground)
                    .opacity(isBusy ? 1 : 0)
            }
        }
        .buttonStyle(.brand(variant, height: height))
        .accessibilityLabel(title)
        .accessibilityValue(isBusy ? "In progress" : "")
    }
}
