import SwiftUI

/// Text tabs with a brand underline on the selected one.
struct UnderlineTabs<Value: Hashable & Identifiable & CustomStringConvertible>: View {
    let tabs: [Value]
    @Binding var selection: Value
    /// Keep unselected labels semibold too (player) instead of medium (book).
    var uniformWeight = false

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 24) {
                ForEach(tabs) { tab in
                    UnderlineTab(
                        title: tab.description,
                        isSelected: tab == selection,
                        uniformWeight: uniformWeight
                    ) {
                        selection = tab
                    }
                }
            }
            .padding(.horizontal, Metrics.gutter)
        }
        .scrollIndicators(.hidden)
        .overlay(alignment: .bottom) {
            Palette.border.frame(height: 1)
        }
    }
}
