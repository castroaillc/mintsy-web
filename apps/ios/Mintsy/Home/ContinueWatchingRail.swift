import SwiftUI

/// "Continue watching" on Home: one card per series in progress, most recent first.
struct ContinueWatchingRail: View {
    let items: [ContinueItem]

    @Environment(PlayerPresenter.self) private var player

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Continue watching")
                .padding(.horizontal, Metrics.gutter)
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 12) {
                    ForEach(items) { item in
                        ContinueCard(item: item) { player.open(item.episode) }
                    }
                }
                .padding(.horizontal, Metrics.gutter)
            }
            .scrollIndicators(.hidden)
        }
    }
}
