import SwiftUI

/// One reminder time as a compact radio tile: "Morning" over "8:00 AM".
struct ReminderTimeTile: View {
    let time: ReminderTime
    @Binding var selection: ReminderTime

    @Environment(\.calendar) private var calendar
    @Environment(\.locale) private var locale

    var body: some View {
        let clock = time.clockText(calendar: calendar, locale: locale)
        RadioCard(isSelected: selection == time, showsIndicator: false, cornerRadius: 14, label: "\(time.label), \(clock)", action: select) {
            VStack(spacing: 4) {
                Text(time.label)
                    .font(BrandFont.inter(13, relativeTo: .footnote))
                    .foregroundStyle(Palette.mutedForeground)
                Text(clock)
                    .font(BrandFont.inter(16, .semibold, relativeTo: .headline))
                    .foregroundStyle(Palette.foreground)
                    .minimumScaleFactor(0.8)
            }
            .lineLimit(1)
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity, minHeight: 72)
        }
    }

    private func select() {
        selection = time
    }
}
