import SwiftUI

/// The subscriber's plan at a glance: plan and price, a status badge, and what happens next.
struct PlanSummaryCard: View {
    let plan: PlanKind?
    let status: PlanStatus
    /// The store's price per period, when it's known.
    let price: String?

    private static let longDate = Date.FormatStyle.dateTime.month(.wide).day().year()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("mintsy\(Text(verbatim: ".").foregroundStyle(Palette.brand)) Premium")
                    .font(BrandFont.display(18, relativeTo: .headline))
                    .accessibilityLabel("mintsy Premium")
                Spacer(minLength: 8)
                Text(status.badge)
                    .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                    .textCase(.uppercase)
                    .foregroundStyle(Palette.background)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 26)
                    .background(badgeColor, in: .capsule)
            }
            Text(headline)
                .font(BrandFont.display(30, relativeTo: .title))
            statusLine
                .font(BrandFont.inter(15))
                .lineSpacing(3)
                .foregroundStyle(Palette.secondaryForeground)
        }
        .foregroundStyle(Palette.foreground)
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.success.opacity(0.16), in: .rect(cornerRadius: 20))
    }

    private var badgeColor: Color {
        switch status {
        case .trial: Palette.brand
        case .active: Palette.success
        case .ending: Palette.destructive
        }
    }

    /// "Yearly · $59.99/year", or just the plan while the price isn't known.
    private var headline: String {
        let name = plan?.name ?? "Premium"
        return price.map { "\(name) · \($0)" } ?? name
    }

    private var statusLine: Text {
        switch status {
        case .trial(let ends):
            if let price {
                Text("Your free trial ends \(ends, format: Self.longDate). Then \(price), renewing automatically.")
            } else {
                Text("Your free trial ends \(ends, format: Self.longDate). Then it renews automatically.")
            }
        case .active(let renews?):
            if let price {
                Text("Renews \(renews, format: Self.longDate) for \(price).")
            } else {
                Text("Renews \(renews, format: Self.longDate).")
            }
        case .active(nil):
            Text("Premium is active on your account.")
        case .ending(let date):
            Text("It won’t renew. Premium stays on until \(date, format: Self.longDate), then your account goes back to the free tier.")
        }
    }
}
