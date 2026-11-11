import SwiftUI

/// What the free plan includes, on Plan details.
struct FreePlanCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Free plan")
                .font(BrandFont.display(26, relativeTo: .title2))
                .foregroundStyle(Palette.foreground)
            Text("You get the first \(SharedConstants.freeEpisodes) episodes of every series. Premium unlocks every episode, with full transcripts and key takeaways.")
                .font(BrandFont.inter(15))
                .lineSpacing(3)
                .foregroundStyle(Palette.mutedForeground)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: .rect(cornerRadius: 20))
        .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(Palette.border) }
    }
}
