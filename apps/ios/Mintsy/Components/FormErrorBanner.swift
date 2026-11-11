import SwiftUI

/// A message under or over a form: an error, or a confirmation ("Password updated").
struct FormErrorBanner: View {
    enum Tone { case error, success }

    let message: String
    var tone: Tone = .error

    var body: some View {
        let color = tone == .error ? Palette.destructive : Palette.success
        Label(message, systemImage: tone == .error ? "exclamationmark.circle" : "checkmark.circle")
            .font(BrandFont.inter(14, relativeTo: .subheadline))
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.12), in: .rect(cornerRadius: 12))
            .accessibilityAddTraits(.isStaticText)
    }
}
