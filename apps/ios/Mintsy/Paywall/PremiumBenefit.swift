import Foundation

/// Something Premium gives, for the paywall's list. Only what the app does today.
nonisolated struct PremiumBenefit: Identifiable, Sendable {
    let title: String
    let detail: String

    var id: String { title }

    static let all = [
        PremiumBenefit(title: "All episodes, every book.", detail: "No more stopping at Episode \(SharedConstants.freeEpisodes)."),
        PremiumBenefit(title: "Full transcripts and key takeaways", detail: "for every chapter."),
        PremiumBenefit(title: "Every new series,", detail: "as soon as it’s added."),
    ]
}
