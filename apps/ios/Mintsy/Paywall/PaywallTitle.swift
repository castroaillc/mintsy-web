import SwiftUI

/// "Keep going with mintsy. Premium", with the brand's dot.
struct PaywallTitle: View {
    var body: some View {
        Text("Keep going with mintsy\(Text(verbatim: ".").foregroundStyle(Palette.brand)) Premium")
            .font(BrandFont.display(32, relativeTo: .largeTitle))
            .foregroundStyle(Palette.foreground)
            .accessibilityLabel("Keep going with mintsy Premium")
            .accessibilityAddTraits(.isHeader)
    }
}
