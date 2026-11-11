import SwiftUI

/// A mock lock-screen notification over the reminders step, previewing a real episode when the catalog has one.
/// Decorative.
struct NotificationPreview: View {
    let books: [Book]

    var body: some View {
        let preview = OnboardingCopy.reminderPreview(books: books)
        let tint = books.first { !$0.episodes.isEmpty }.flatMap { Color(hex: $0.tint) }
        HStack(alignment: .top, spacing: 12) {
            Image("Mark")
                .resizable()
                .scaledToFit()
                .padding(8)
                .frame(width: 38, height: 38)
                .background(Palette.background, in: .rect(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(verbatim: "mintsy")
                        .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                        .foregroundStyle(Palette.secondaryForeground)
                    Spacer()
                    Text("now")
                        .font(BrandFont.inter(12, relativeTo: .caption))
                        .foregroundStyle(Palette.mutedForeground)
                }
                Text(preview.title)
                    .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
                Text(preview.body)
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.secondaryForeground)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .padding(14)
        .frame(maxWidth: 300)
        .background(Palette.surfaceRaised.opacity(0.95), in: .rect(cornerRadius: 18))
        .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(Palette.input) }
        .shadow(color: .black.opacity(0.4), radius: 15, y: 14)
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, minHeight: 210)
        .background(tint ?? Palette.brand.opacity(0.1), in: .rect(cornerRadius: 22))
        .accessibilityHidden(true)
    }
}
