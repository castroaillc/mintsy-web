import SwiftUI

/// The quiet text button under an onboarding step's main one ("Not now", "Browse all series instead").
struct SecondaryActionButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .font(BrandFont.inter(15, .medium, relativeTo: .subheadline))
            .foregroundStyle(Palette.mutedForeground)
            .frame(maxWidth: .infinity, minHeight: Metrics.minTap)
            .contentShape(.rect)
            .buttonStyle(.plain)
    }
}
