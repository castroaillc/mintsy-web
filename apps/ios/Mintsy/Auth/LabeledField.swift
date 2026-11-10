import SwiftUI

/// A form field with its label above, styled like the Expo app's `TextField`.
struct LabeledField<Field: View>: View {
    let label: String
    @ContentBuilder let field: Field

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(BrandFont.inter(14, .medium, relativeTo: .subheadline))
                .foregroundStyle(Palette.foreground)
            field
                .font(BrandFont.inter(16))
                .foregroundStyle(Palette.foreground)
                .padding(.horizontal, 16)
                .frame(minHeight: 52)
                .background(Palette.surfaceRaised, in: .rect(cornerRadius: 14))
                .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.input) }
                .accessibilityLabel(label)
        }
    }
}
