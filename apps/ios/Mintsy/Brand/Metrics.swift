import Foundation

/// Spacing and sizes shared by the screens, from the designs (`design/*.dc.html`).
nonisolated enum Metrics {
    /// Side margin of every screen.
    static let gutter: Double = 20
    /// Minimum touch target.
    static let minTap: Double = 44
    /// Widest a column of reading text gets in a wide window.
    static let readableWidth: Double = 640
    /// Episodes per range pill on a book's page.
    static let episodeRange = 10
}
