import SwiftUI

/// One daily goal as a radio card: the minutes in a tile, its name and what it means in episodes.
struct DailyGoalCard: View {
    let goal: DailyGoal
    let caption: String
    @Binding var selection: DailyGoal

    var body: some View {
        RadioCard(isSelected: selection == goal, label: "\(goal.title), \(caption)", action: select) {
            HStack(spacing: 14) {
                VStack(spacing: 0) {
                    Text(verbatim: goal == .flexible ? "?" : "\(goal.minutes)")
                        .font(BrandFont.display(20, relativeTo: .title3))
                        .foregroundStyle(Palette.foreground)
                    Text(goal == .flexible ? "flex" : "min")
                        .font(BrandFont.inter(11, relativeTo: .caption))
                        .foregroundStyle(Palette.mutedForeground)
                }
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
                .frame(width: 56, height: 56)
                .background(Palette.tag, in: .rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 3) {
                    Text(goal.title)
                        .font(BrandFont.inter(16, .semibold, relativeTo: .headline))
                        .foregroundStyle(Palette.foreground)
                    Text(caption)
                        .font(BrandFont.inter(14, relativeTo: .subheadline))
                        .foregroundStyle(Palette.mutedForeground)
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding([.leading, .vertical], 16)
        }
        .padding(.trailing, 0)
    }

    private func select() {
        selection = goal
    }
}
