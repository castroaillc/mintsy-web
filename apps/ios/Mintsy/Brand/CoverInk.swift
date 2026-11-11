import SwiftUI

/// Dark or light cover ink, whichever reads on a cover tone (the Expo app's `coverInk`).
nonisolated enum CoverInk {
    static func isLight(_ hex: String) -> Bool {
        let digits = hex.hasPrefix("#") ? hex.dropFirst() : Substring(hex)
        guard let value = UInt32(digits, radix: 16) else { return false }
        let r = Double((value >> 16) & 0xFF), g = Double((value >> 8) & 0xFF), b = Double(value & 0xFF)
        return 0.299 * r + 0.587 * g + 0.114 * b > 150
    }

    static func color(on hex: String) -> Color {
        isLight(hex) ? Palette.coverInkOnLight : Palette.coverInkOnDark
    }
}
