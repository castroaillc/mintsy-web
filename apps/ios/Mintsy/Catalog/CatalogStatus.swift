import Foundation

nonisolated enum CatalogStatus: Equatable, Sendable {
    case loading
    case ready
    case failed(String)
}
