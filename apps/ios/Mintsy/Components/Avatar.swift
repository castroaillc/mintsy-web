import SwiftUI

/// The viewer's initial in a ring of the brand color (designs 11 and 12).
struct Avatar: View {
    let name: String
    var size: Double = 76

    var body: some View {
        let initial = name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() }
        ZStack {
            if let initial {
                Text(initial)
                    .font(BrandFont.display(size * 0.4, relativeTo: .title))
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.36))
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.large)
        .foregroundStyle(Palette.onTint)
        .frame(width: size, height: size)
        .background(Palette.episodeTints[0], in: .circle)
        .overlay { Circle().strokeBorder(Palette.brand, lineWidth: 2) }
        .accessibilityHidden(true)
    }
}
