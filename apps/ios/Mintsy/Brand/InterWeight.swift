/// The Inter weights bundled from packages/brand.
nonisolated enum InterWeight: Sendable {
    case regular, medium, semibold, bold

    var postScriptName: String {
        switch self {
        case .regular: BrandFontName.bodyRegular
        case .medium: BrandFontName.bodyMedium
        case .semibold: BrandFontName.bodySemibold
        case .bold: BrandFontName.bodyBold
        }
    }
}
