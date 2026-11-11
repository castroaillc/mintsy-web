import SwiftUI

/// Save to My List, or remove it (Expo's "+ My List" on the series page).
struct SaveBookButton: View {
    let book: Book

    @Environment(SavedStore.self) private var saved

    var body: some View {
        let isSaved = saved.isSaved(.book, book.id)
        Button(isSaved ? "Saved" : "Save", systemImage: isSaved ? "bookmark.fill" : "bookmark", action: toggle)
            .labelStyle(.iconOnly)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(isSaved ? Palette.brand : Palette.foreground)
            .frame(width: 52, height: 52)
            .background(Palette.surfaceRaised, in: .rect(cornerRadius: 14))
            .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Palette.borderStrong) }
            .contentShape(.rect)
            .buttonStyle(.plain)
            .accessibilityLabel(isSaved ? "Remove \(book.title) from My List" : "Add \(book.title) to My List")
            .sensoryFeedback(.selection, trigger: isSaved)
    }

    private func toggle() {
        saved.toggle(.book, book.id)
    }
}
