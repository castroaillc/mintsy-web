import Foundation

/// Where onboarding answers are kept, one set per account.
protocol OnboardingStorage {
    /// The account's saved answers; nil when there are none (or they can't be read).
    func read(userID: String) -> OnboardingAnswers?
    func write(_ answers: OnboardingAnswers, userID: String)
    func remove(userID: String)
}
