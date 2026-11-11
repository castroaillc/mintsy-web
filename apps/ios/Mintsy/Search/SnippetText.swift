import SwiftUI

/// A search match's line, in quotes, with the matched text marked (design 35).
nonisolated enum SnippetText {
    static func highlighted(_ hit: SearchHit) -> AttributedString {
        guard let range = hit.matchRange else { return AttributedString("“\(hit.snippet)”") }
        var match = AttributedString(hit.snippet[range])
        match.foregroundColor = Palette.foreground
        match.backgroundColor = Palette.brand.opacity(0.22)
        match.inlinePresentationIntent = .stronglyEmphasized
        let before = AttributedString("“" + hit.snippet[..<range.lowerBound])
        let after = AttributedString(hit.snippet[range.upperBound...] + "”")
        return before + match + after
    }
}
