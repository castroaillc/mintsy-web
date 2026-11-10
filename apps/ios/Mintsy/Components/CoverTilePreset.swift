import Foundation

/// Type sizes and padding of a generated cover tile, from the mockups, keyed by tile width.
nonisolated struct CoverTilePreset: Sendable {
    let title: Double
    /// Author font size; 0 hides the author (tiny thumbnails).
    let author: Double
    let padV: Double
    let padH: Double
    let radius: Double
    let hasShadow: Bool

    private static let presets: [(width: Double, preset: CoverTilePreset)] = [
        (48, .init(title: 8, author: 0, padV: 6, padH: 5, radius: 5, hasShadow: false)),
        (72, .init(title: 11, author: 8, padV: 8, padH: 7, radius: 6, hasShadow: false)),
        (104, .init(title: 14, author: 10, padV: 11, padH: 10, radius: 8, hasShadow: false)),
        (124, .init(title: 16, author: 11, padV: 12, padH: 11, radius: 8, hasShadow: false)),
        (128, .init(title: 17, author: 10, padV: 14, padH: 12, radius: 8, hasShadow: true)),
        (132, .init(title: 19, author: 11, padV: 14, padH: 12, radius: 6, hasShadow: true)),
        (150, .init(title: 22, author: 12, padV: 16, padH: 14, radius: 6, hasShadow: true)),
        (152, .init(title: 21, author: 11, padV: 16, padH: 14, radius: 8, hasShadow: true)),
    ]

    /// The preset of the nearest mockup size.
    static func forWidth(_ width: Double) -> CoverTilePreset {
        presets.min { abs($0.width - width) < abs($1.width - width) }?.preset ?? presets[3].preset
    }
}
