import Foundation

/// The tabs on a book's page.
enum BookTab: String, CaseIterable, Identifiable, CustomStringConvertible {
    case episodes, transcripts, about

    var id: Self { self }

    var description: String {
        switch self {
        case .episodes: "Episodes"
        case .transcripts: "Transcripts"
        case .about: "About the book"
        }
    }
}
