import SwiftUI

/// Filters the books on Home by title, author or category.
struct HomeSearchField: View {
    @Binding var query: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Palette.faint)
                .accessibilityHidden(true)
            TextField("Search books, authors, topics", text: $query)
                .font(BrandFont.inter(15))
                .foregroundStyle(Palette.foreground)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .accessibilityLabel("Search books")
            if !query.isEmpty {
                Button("Clear search", systemImage: "xmark.circle.fill", action: clear)
                    .labelStyle(.iconOnly)
                    .foregroundStyle(Palette.faint)
                    .frame(minWidth: Metrics.minTap, minHeight: Metrics.minTap)
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, query.isEmpty ? 16 : 4)
        .frame(minHeight: 50)
        .background(Palette.surfaceRaised, in: .rect(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.input) }
    }

    private func clear() {
        query = ""
    }
}
