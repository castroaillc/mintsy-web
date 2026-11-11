import SwiftUI

/// The look of a form field's box (the Expo app's `TextField`): raised surface, hairline border, 52 pt tall.
struct FieldBox: ViewModifier {
    var isInvalid = false

    func body(content: Content) -> some View {
        content
            .font(BrandFont.inter(16))
            .foregroundStyle(Palette.foreground)
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(Palette.surfaceRaised, in: .rect(cornerRadius: 14))
            .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(isInvalid ? Palette.destructive : Palette.input) }
    }
}

extension View {
    func fieldBox(isInvalid: Bool = false) -> some View {
        modifier(FieldBox(isInvalid: isInvalid))
    }
}
