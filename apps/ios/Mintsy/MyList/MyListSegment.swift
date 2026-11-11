import Foundation

/// My List's sections (design 37).
nonisolated enum MyListSegment: String, CaseIterable, Identifiable, Sendable {
    case saved = "Saved"
    case inProgress = "In progress"
    case finished = "Finished"

    var id: Self { self }
    var title: LocalizedStringResource { LocalizedStringResource(stringLiteral: rawValue) }
}
