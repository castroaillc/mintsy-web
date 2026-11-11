import SwiftUI

/// A small fact about a book ("12 episodes", "Finance").
struct TagPill: View {
    let text: LocalizedStringResource

    var body: some View {
        Text(text)
            .font(BrandFont.inter(13, relativeTo: .footnote))
            .foregroundStyle(Palette.secondaryForeground)
            .padding(.horizontal, 10)
            .frame(minHeight: 28)
            .background(Palette.tag, in: .rect(cornerRadius: 8))
    }
}
