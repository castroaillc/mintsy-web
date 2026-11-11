import SwiftUI

/// What deleting the account removes.
struct DeletedDataCard: View {
    private static let items: [LocalizedStringResource] = [
        "Your profile, name and email",
        "Watch progress and finished series",
        "My List (saved series and episodes)",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("What’s deleted")
                .font(BrandFont.inter(13, .semibold, relativeTo: .footnote))
                .textCase(.uppercase)
                .kerning(1)
                .foregroundStyle(Palette.mutedForeground)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Self.items, id: \.key) { item in
                    Label {
                        Text(item)
                            .font(BrandFont.inter(15))
                            .foregroundStyle(Palette.foreground)
                    } icon: {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Palette.destructive)
                            .frame(width: 20, height: 20)
                            .background(Palette.destructive.opacity(0.12), in: .circle)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.card, in: .rect(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.border) }
        }
    }
}
