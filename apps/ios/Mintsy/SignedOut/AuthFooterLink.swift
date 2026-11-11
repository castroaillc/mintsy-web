import SwiftUI

/// "Already have an account? Sign in" at the bottom of a form.
struct AuthFooterLink: View {
    let prompt: String
    let action: String
    let perform: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(prompt)
                .foregroundStyle(Palette.mutedForeground)
            Button(action, action: perform)
                .font(BrandFont.inter(15, .semibold, relativeTo: .subheadline))
                .foregroundStyle(Palette.foreground)
                .frame(minHeight: Metrics.minTap)
        }
        .font(BrandFont.inter(15, relativeTo: .subheadline))
    }
}
