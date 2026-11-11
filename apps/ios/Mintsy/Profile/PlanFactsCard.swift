import SwiftUI

/// Plan, next charge, who bills it and member since, as a card of rows (design 50).
struct PlanFactsCard: View {
    let premium: Premium
    let status: PlanStatus
    let memberSince: Date?

    var body: some View {
        VStack(spacing: 0) {
            PlanFactRow(title: "Plan", value: Text(premium.planKind?.name ?? "Premium"))
            Divider().overlay(Palette.border)
            PlanFactRow(title: "Next charge", value: nextCharge)
            if let store = premium.storeName {
                Divider().overlay(Palette.border)
                PlanFactRow(title: "Billed through", value: Text(store))
            }
            if let memberSince {
                Divider().overlay(Palette.border)
                PlanFactRow(title: "Member since", value: Text(memberSince, format: .dateTime.month(.abbreviated).year()))
            }
        }
        .background(Palette.card, in: .rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.border) }
    }

    private var nextCharge: Text {
        switch status {
        case .trial(let date), .active(let date?):
            Text(date, format: .dateTime.month(.abbreviated).day().year())
        case .active(nil), .ending:
            Text("None")
        }
    }
}
