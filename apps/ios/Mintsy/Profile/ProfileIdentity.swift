import SwiftUI

/// Avatar, name, "Member since" and Edit (design 11).
struct ProfileIdentity: View {
    let user: AuthUser
    let onEdit: () -> Void

    @Environment(PremiumStore.self) private var premium

    var body: some View {
        HStack(spacing: 16) {
            Avatar(name: user.name)
            VStack(alignment: .leading, spacing: 4) {
                Text(user.name.isEmpty ? "mintsy reader" : user.name)
                    .font(BrandFont.inter(20, .semibold, relativeTo: .title3))
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(2)
                if premium.isPremium {
                    Text("Premium")
                        .font(BrandFont.inter(11, .semibold, relativeTo: .caption2))
                        .textCase(.uppercase)
                        .kerning(0.4)
                        .foregroundStyle(Palette.brandForeground)
                        .padding(.horizontal, 8)
                        .frame(minHeight: 20)
                        .background(Palette.brand, in: .capsule)
                }
                if let since = user.memberSince {
                    Text("Member since \(since, format: .dateTime.month(.abbreviated).year())")
                        .font(BrandFont.inter(14, relativeTo: .subheadline))
                        .foregroundStyle(Palette.mutedForeground)
                } else {
                    Text(user.email)
                        .font(BrandFont.inter(14, relativeTo: .subheadline))
                        .foregroundStyle(Palette.mutedForeground)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button("Edit", action: onEdit)
                .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                .foregroundStyle(Palette.foreground)
                .padding(.horizontal, 14)
                .frame(minHeight: Metrics.minTap)
                .overlay { Capsule().strokeBorder(Palette.borderStrong).frame(height: 40) }
                .contentShape(.rect)
                .buttonStyle(.plain)
                .accessibilityLabel("Edit profile")
        }
    }
}
