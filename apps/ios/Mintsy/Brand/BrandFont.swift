import SwiftUI

/// The brand typefaces at the sizes the designs use, scaling with Dynamic Type from the given text style.
nonisolated enum BrandFont {
    /// Space Grotesk Bold (`font-display`), for titles and headings.
    static func display(_ size: Double, relativeTo style: Font.TextStyle = .title2) -> Font {
        .custom(BrandFontName.displayBold, size: size, relativeTo: style)
    }

    /// Space Grotesk Medium (`font-display-medium`).
    static func displayMedium(_ size: Double, relativeTo style: Font.TextStyle = .title3) -> Font {
        .custom(BrandFontName.displayMedium, size: size, relativeTo: style)
    }

    /// Inter (`font-inter`, `-medium`, `-semibold`), for everything else.
    static func inter(_ size: Double, _ weight: InterWeight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(weight.postScriptName, size: size, relativeTo: style)
    }
}
