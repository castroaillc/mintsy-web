import SwiftUI

/// The line under a field: its error when there is one, else its hint.
struct FieldCaption: View {
    let hint: String?
    let error: String?

    var body: some View {
        if let error {
            Label(error, systemImage: "exclamationmark.circle")
                .font(BrandFont.inter(13, relativeTo: .footnote))
                .foregroundStyle(Palette.destructive)
        } else if let hint {
            Text(hint)
                .font(BrandFont.inter(13, relativeTo: .footnote))
                .foregroundStyle(Palette.faint)
        }
    }
}
