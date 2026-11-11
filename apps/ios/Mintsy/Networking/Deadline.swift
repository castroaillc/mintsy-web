import Foundation

/// Thrown by `withDeadline` when the work took too long.
nonisolated struct DeadlineExceeded: Error {}

/// Runs `work`, and gives up (cancelling it) after `limit`.
nonisolated func withDeadline<T: Sendable>(
    _ limit: Duration,
    _ work: @escaping @Sendable () async throws -> T
) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await work() }
        group.addTask {
            try await Task.sleep(for: limit)
            throw DeadlineExceeded()
        }
        defer { group.cancelAll() }
        guard let first = try await group.next() else { throw DeadlineExceeded() }
        return first
    }
}
