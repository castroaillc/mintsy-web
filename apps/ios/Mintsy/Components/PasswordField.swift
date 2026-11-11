import SwiftUI

/// A password field with Show / Hide (designs 5, 6 and 47), its label, and a hint or error below.
struct PasswordField<Accessory: View>: View {
    let label: String
    @Binding var text: String
    var placeholder = "Your password"
    var isNew = false
    var hint: String?
    var error: String?
    var submitLabel: SubmitLabel = .done
    var onSubmit: () -> Void = {}
    @ContentBuilder let accessory: Accessory

    @State private var isRevealed = false

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
            HStack(spacing: 4) {
                PasswordInput(placeholder: placeholder, text: $text, isRevealed: isRevealed)
                    .textContentType(isNew ? .newPassword : .password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(submitLabel)
                    .onSubmit(onSubmit)
                    .accessibilityLabel(label)
                Button(isRevealed ? "Hide password" : "Show password", systemImage: isRevealed ? "eye.slash" : "eye", action: toggle)
                    .labelStyle(.iconOnly)
                    .foregroundStyle(Palette.mutedForeground)
                    .frame(width: Metrics.minTap, height: Metrics.minTap)
                    .contentShape(.rect)
                    .buttonStyle(.plain)
            }
            .padding(.trailing, -12)
            .fieldBox(isInvalid: error != nil)
            FieldCaption(hint: hint, error: error)
        }
    }

    private func toggle() {
        isRevealed.toggle()
    }
}

extension PasswordField where Accessory == EmptyView {
    init(
        label: String, text: Binding<String>, placeholder: String = "Your password", isNew: Bool = false,
        hint: String? = nil, error: String? = nil, submitLabel: SubmitLabel = .done, onSubmit: @escaping () -> Void = {}
    ) {
        self.init(
            label: label, text: text, placeholder: placeholder, isNew: isNew, hint: hint, error: error,
            submitLabel: submitLabel, onSubmit: onSubmit, accessory: { EmptyView() }
        )
    }
}
