import SwiftUI

/// The shell of the sign-in, sign-up and password forms (designs 5, 6, 45–47): title, subtitle, the form, and a
/// footer at the bottom of the screen that scrolls with the form when space runs out.
struct AuthScreen<Content: View, Footer: View>: View {
    let title: String
    let subtitle: String
    @ContentBuilder let content: Content
    @ContentBuilder let footer: Footer

    @State private var viewportHeight: Double = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                        .font(BrandFont.display(32, relativeTo: .largeTitle))
                        .foregroundStyle(Palette.foreground)
                        .accessibilityAddTraits(.isHeader)
                    Text(subtitle)
                        .font(BrandFont.inter(16))
                        .lineSpacing(4)
                        .foregroundStyle(Palette.mutedForeground)
                }
                .padding(.top, 12)

                VStack(alignment: .leading, spacing: 18) {
                    content
                }
                .padding(.top, 32)

                Spacer(minLength: 32)
                footer
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
            .frame(maxWidth: 480, minHeight: viewportHeight, alignment: .top)
            .frame(maxWidth: .infinity)
        }
        .onGeometryChange(for: Double.self) { $0.size.height } action: { viewportHeight = $0 }
        .scrollDismissesKeyboard(.interactively)
        .scrollBounceBehavior(.basedOnSize)
        .background(Palette.background)
        .toolbarTitleDisplayMode(.inline)
    }
}

extension AuthScreen where Footer == EmptyView {
    init(title: String, subtitle: String, @ContentBuilder content: () -> Content) {
        self.init(title: title, subtitle: subtitle, content: content, footer: { EmptyView() })
    }
}
