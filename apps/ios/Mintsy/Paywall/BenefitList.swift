import SwiftUI

/// What Premium gives, as a checklist.
struct BenefitList: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(PremiumBenefit.all) { benefit in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(Palette.brand)
                        .accessibilityHidden(true)
                    Text("\(Text(benefit.title).font(BrandFont.inter(15, .semibold)).foregroundStyle(Palette.foreground)) \(benefit.detail)")
                        .font(BrandFont.inter(15))
                        .foregroundStyle(Palette.mutedForeground)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}
