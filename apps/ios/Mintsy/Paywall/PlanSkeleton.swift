import SwiftUI

/// A placeholder plan card while the plans load.
struct PlanSkeleton: View {
    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .frame(width: 22, height: 22)
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4).frame(width: 80, height: 14)
                RoundedRectangle(cornerRadius: 4).frame(width: 176, height: 12)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            RoundedRectangle(cornerRadius: 4).frame(width: 56, height: 16)
        }
        .foregroundStyle(Palette.tag)
        .padding(16)
        .background(Palette.card, in: .rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.input, lineWidth: 2) }
    }
}
