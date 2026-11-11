import SwiftUI

/// One plan as a radio card: name, how it's billed, and the store's price.
struct PlanCard: View {
    let plan: Plan
    @Binding var selection: PlanKind
    /// "Best value · Save 50%" on the yearly plan.
    let badge: String?

    var body: some View {
        let isSelected = selection == plan.kind
        Button(action: select) {
            HStack(spacing: 14) {
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Palette.brand : Palette.ring)
                VStack(alignment: .leading, spacing: 3) {
                    Text(plan.kind.name)
                        .font(BrandFont.inter(16, .semibold, relativeTo: .headline))
                        .foregroundStyle(Palette.foreground)
                    Text(plan.billingNote)
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .foregroundStyle(Palette.mutedForeground)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(plan.priceString)
                    .font(BrandFont.inter(16, .semibold, relativeTo: .headline))
                    .foregroundStyle(Palette.foreground)
                    .layoutPriority(1)
            }
            .padding(16)
            .background(isSelected ? Palette.brand.opacity(0.06) : Palette.card, in: .rect(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(isSelected ? Palette.brand : Palette.input, lineWidth: 2)
            }
            .contentShape(.rect(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .overlay(alignment: .topTrailing) {
            if let badge {
                Text(badge)
                    .font(BrandFont.inter(11, .semibold, relativeTo: .caption2))
                    .textCase(.uppercase)
                    .kerning(0.4)
                    .foregroundStyle(Palette.brandForeground)
                    .padding(.horizontal, 9)
                    .frame(minHeight: 22)
                    .background(Palette.brand, in: .capsule)
                    .alignmentGuide(VerticalAlignment.top) { $0[VerticalAlignment.center] }
                    .padding(.trailing, 16)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityLabel("\(plan.kind.name), \(plan.priceString) per \(plan.kind.periodNoun). \(plan.billingNote)\(badge.map { ". \($0)" } ?? "")")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func select() {
        selection = plan.kind
    }
}
