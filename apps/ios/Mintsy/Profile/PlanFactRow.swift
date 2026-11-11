import SwiftUI

/// A label and its value on Plan details.
struct PlanFactRow: View {
    let title: LocalizedStringResource
    let value: Text

    var body: some View {
        LabeledContent {
            value
                .foregroundStyle(Palette.foreground)
        } label: {
            Text(title)
                .foregroundStyle(Palette.mutedForeground)
        }
        .font(BrandFont.inter(15))
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
    }
}
