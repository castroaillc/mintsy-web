import SwiftUI

/// The mark in its tile beside the wordmark (design 4).
struct WelcomeLogo: View {
    var body: some View {
        HStack(spacing: 10) {
            Image("Mark")
                .resizable()
                .scaledToFit()
                .padding(8)
                .frame(width: 40, height: 40)
                .background(Palette.card, in: .rect(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Palette.border) }
                .accessibilityHidden(true)
            Wordmark(size: 22)
        }
    }
}
