import SwiftUI

/// A row that leads somewhere: title, an optional value, and a chevron.
struct LinkRowLabel: View {
    let title: LocalizedStringResource
    let value: LocalizedStringResource?

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(BrandFont.inter(15))
                .foregroundStyle(Palette.foreground)
            Spacer(minLength: 12)
            if let value {
                Text(value)
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.mutedForeground)
            }
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Palette.faint)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 56)
        .contentShape(.rect)
    }
}
