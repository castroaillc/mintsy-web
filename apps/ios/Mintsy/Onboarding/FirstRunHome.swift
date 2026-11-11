import Foundation

/// Home for a viewer who hasn't watched anything yet (design 39): one series to start, the daily goal, and rows from
/// their interests.
nonisolated struct FirstRunHome: Equatable {
    /// The series to start with.
    let hero: Book
    /// "Your pick from onboarding", or why it's suggested.
    let heroReason: String
    /// "Today’s goal: 15 minutes"; nil without a daily goal.
    let goalTitle: String?
    /// "That’s about 3 episodes."; nil when the catalog can't say.
    let goalDetail: String?
    let rows: [HomeSections.Row]

    /// Home is in its first-run state once the viewer's progress is known to be empty, while they aren't searching
    /// or filtering.
    static func applies(progressLoaded: Bool, hasProgress: Bool, query: String, category: String) -> Bool {
        progressLoaded && !hasProgress && category == HomeSections.allCategories
            && query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Nil when the catalog has nothing to play.
    init?(books: [Book], answers: OnboardingAnswers) {
        let picks = Recommender.picks(from: books, interests: answers.interests)
        let chosen = answers.firstSeriesBookID.flatMap { id in books.first { $0.id == id && !$0.episodes.isEmpty } }
        guard let hero = chosen ?? picks.first?.book else { return nil }
        self.hero = hero
        heroReason = chosen != nil ? "Your pick from onboarding" : (picks.first?.reason ?? "From the catalog")

        if answers.dailyGoal == .flexible {
            goalTitle = nil
            goalDetail = nil
        } else {
            goalTitle = "Today’s goal: \(answers.dailyGoal.minutes) minutes"
            goalDetail = CatalogAverages(books: books).map { averages in
                let perDay = averages.episodesPerDay(minutes: answers.dailyGoal.minutes)
                return "That’s about \(perDay) \(perDay == 1 ? "episode" : "episodes")."
            }
        }

        // One row per category the interests point at, in the order they were picked (two at most), then the newest
        var rows: [HomeSections.Row] = []
        var categories: Set<String> = []
        for interest in answers.interests where rows.count < 2 && categories.insert(interest.category).inserted {
            let matching = books.filter { $0.category == interest.category && !$0.episodes.isEmpty && $0.id != hero.id }
            if !matching.isEmpty {
                rows.append(HomeSections.Row(title: "Because you picked \(interest.rawValue)", books: matching))
            }
        }
        let newest = Array(books.suffix(4).reversed())
        if !newest.isEmpty {
            rows.append(HomeSections.Row(title: "Recently added", books: newest))
        }
        self.rows = rows
    }
}
