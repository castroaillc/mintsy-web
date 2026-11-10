import SwiftUI

/// An error under a form.
struct FormErrorBanner: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "exclamationmark.circle")
            .font(BrandFont.inter(14, relativeTo: .subheadline))
            .foregroundStyle(Palette.destructive)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.destructive.opacity(0.12), in: .rect(cornerRadius: 12))
            .accessibilityAddTraits(.isStaticText)
    }
}
