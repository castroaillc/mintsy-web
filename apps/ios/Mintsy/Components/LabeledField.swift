import SwiftUI

/// A form field with its label above, an optional link on the label's row ("Forgot password?") and a hint or
/// error below, styled like the Expo app's `TextField`.
struct LabeledField<Field: View, Accessory: View>: View {
    let label: String
    var hint: String?
    var error: String?
    @ContentBuilder let field: Field
    @ContentBuilder let accessory: Accessory

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                    .foregroundStyle(Palette.secondaryForeground)
                    .accessibilityHidden(true)
                Spacer(minLength: 8)
                accessory
            }
            field
                .fieldBox(isInvalid: error != nil)
                .accessibilityLabel(label)
            FieldCaption(hint: hint, error: error)
        }
    }
}

extension LabeledField where Accessory == EmptyView {
    init(label: String, hint: String? = nil, error: String? = nil, @ContentBuilder field: () -> Field) {
        self.init(label: label, hint: hint, error: error, field: field, accessory: { EmptyView() })
    }
}
