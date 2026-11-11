import SwiftUI

/// "In progress" on Profile: up to three series with how much is watched, and See all.
struct ProfileInProgressSection: View {
    let items: [ContinueItem]
    let progress: [String: EpisodeProgress]
    let onSeeAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                SectionHeader(title: "In progress")
                Spacer()
                Button("See all", action: onSeeAll)
                    .font(BrandFont.inter(14, relativeTo: .subheadline))
                    .foregroundStyle(Palette.mutedForeground)
                    .frame(minHeight: Metrics.minTap)
                    .accessibilityLabel("See all in progress")
            }
            ForEach(items) { item in
                NavigationLink(value: BookRoute(bookID: item.book.id)) {
                    InProgressRow(item: item, progress: progress)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
