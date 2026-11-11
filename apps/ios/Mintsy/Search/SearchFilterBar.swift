import SwiftUI

/// All / Books / Episodes (design 35).
struct SearchFilterBar: View {
    @Binding var selection: SearchFilter

    var body: some View {
        HStack(spacing: 8) {
            ForEach(SearchFilter.allCases) { filter in
                CategoryChip(label: filter.rawValue, isSelected: selection == filter, compact: true) {
                    selection = filter
                }
            }
        }
        .padding(.top, 10)
    }
}
