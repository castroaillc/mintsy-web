import SwiftUI

/// A tab that the native app doesn't have yet. Says so plainly, so nobody mistakes it for an empty result.
struct NotBuiltYetView: View {
    let title: String
    let systemImage: String
    let detail: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label(title, systemImage: systemImage)
            } description: {
                Text(detail)
            } actions: {
                Text("Not built yet")
                    .font(BrandFont.inter(12, .semibold, relativeTo: .caption))
                    .textCase(.uppercase)
                    .kerning(1.2)
                    .foregroundStyle(Palette.brand)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Palette.brand.opacity(0.12), in: .capsule)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Palette.background)
            .navigationTitle(title)
            .toolbarTitleDisplayMode(.inline)
        }
    }
}
