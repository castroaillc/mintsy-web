import SwiftUI

/// The last step's suggestions, or the catalog's loading and failed states.
struct FirstSeriesPicks: View {
    let picks: [Recommendation]
    let selectedID: String?
    let status: CatalogStatus
    let onSelect: (Recommendation) -> Void
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            if !picks.isEmpty {
                ForEach(picks) { pick in
                    SeriesPickCard(pick: pick, isSelected: pick.id == selectedID, onSelect: onSelect)
                }
            } else if status == .loading {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Palette.card)
                        .frame(height: 132)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Loading series")
            } else {
                ContentUnavailableView {
                    Label("Couldn’t load series", systemImage: "wifi.exclamationmark")
                } description: {
                    Text("Check your connection, or browse once you’re in.")
                } actions: {
                    Button("Try again", action: onRetry)
                        .buttonStyle(.brand(.outline, height: 44))
                        .frame(maxWidth: 200)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("First series")
    }
}
