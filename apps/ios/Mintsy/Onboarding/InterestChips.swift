import SwiftUI

/// Every interest as a wrapping row of chips. Picks keep the order they were made in.
struct InterestChips: View {
    @Binding var picked: [Interest]
    var compact = false

    var body: some View {
        FlowLayout(spacing: compact ? 8 : 10) {
            ForEach(Interest.allCases) { interest in
                SelectChip(label: interest.rawValue, isSelected: picked.contains(interest), compact: compact) {
                    toggle(interest)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .sensoryFeedback(.selection, trigger: picked)
    }

    private func toggle(_ interest: Interest) {
        if let index = picked.firstIndex(of: interest) {
            picked.remove(at: index)
        } else {
            picked.append(interest)
        }
    }
}
