import SwiftUI

/// My List › In progress: one row per series, most recent first, with Resume.
struct InProgressList: View {
    let items: [ContinueItem]
    let isLoading: Bool

    @Environment(PlayerPresenter.self) private var player

    var body: some View {
        if isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 240)
        } else if items.isEmpty {
            ContentUnavailableView(
                "Nothing in progress",
                systemImage: "play.circle",
                description: Text("Series you start watching show up here, so you can pick up where you left off.")
            )
            .padding(.top, 40)
        } else {
            LazyVStack(alignment: .leading, spacing: 10) {
                Text("^[\(items.count) series](inflect: true) in progress")
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
                ForEach(items) { item in
                    InProgressListRow(item: item) { player.open(item.episode) }
                }
            }
        }
    }
}
