import SwiftUI

/// A My List row (design 37): what it opens on the left, and one round action on the right (remove, resume,
/// watch again).
struct LibraryRow<Main: View>: View {
    let actionTitle: String
    let actionImage: String
    var actionTint: Color = Palette.foreground
    let action: () -> Void
    @ContentBuilder let main: Main

    var body: some View {
        HStack(spacing: 8) {
            main
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(actionTitle, systemImage: actionImage, action: action)
                .labelStyle(.iconOnly)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(actionTint)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .overlay { Circle().strokeBorder(Palette.input) }
                .contentShape(.circle)
                .buttonStyle(.plain)
        }
        .padding(10)
        .background(Palette.card, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.border) }
    }
}
