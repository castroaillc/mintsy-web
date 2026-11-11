import SwiftUI

/// The plans couldn't be shown: why, and Try again.
struct PlansUnavailableCard: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.circle")
                .font(.title2)
                .foregroundStyle(Palette.mutedForeground)
                .accessibilityHidden(true)
            Text(message)
                .font(BrandFont.inter(15))
                .foregroundStyle(Palette.foreground)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button("Try again", action: onRetry)
                .buttonStyle(.brand(.outline, height: 44))
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(Palette.card, in: .rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.border) }
    }
}
