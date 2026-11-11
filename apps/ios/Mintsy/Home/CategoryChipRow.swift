import SwiftUI

/// "All" plus the shared categories, as a horizontally scrolling single-select row.
struct CategoryChipRow: View {
    @Binding var selection: String

    private static let options = [HomeSections.allCategories] + SharedConstants.categories

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(Self.options, id: \.self) { option in
                    CategoryChip(label: option, isSelected: option == selection) {
                        selection = option
                    }
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.bottom, 4)
        }
        .scrollIndicators(.hidden)
    }
}
