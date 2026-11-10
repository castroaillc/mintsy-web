import SwiftUI

/// The wordmark and the profile button (the viewer's initial).
struct HomeHeader: View {
    let user: AuthUser
    let onOpenProfile: () -> Void

    var body: some View {
        HStack {
            Wordmark(size: 26)
            Spacer()
            Button(action: onOpenProfile) {
                Group {
                    if let initial = user.initial {
                        Text(initial)
                            .font(BrandFont.displayMedium(17, relativeTo: .headline))
                    } else {
                        Image(systemName: "person")
                    }
                }
                .foregroundStyle(Palette.foreground)
                .frame(width: Metrics.minTap, height: Metrics.minTap)
                .background(Palette.surfaceRaised, in: .circle)
                .overlay { Circle().strokeBorder(Palette.input) }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Profile")
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 20)
        .padding(.bottom, 12)
    }
}
