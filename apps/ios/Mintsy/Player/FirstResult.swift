import Foundation

/// Resumes a continuation with whichever value arrives first, and ignores the rest.
final class FirstResult<Value: Sendable> {
    var continuation: CheckedContinuation<Value, Never>?

    func finish(_ value: Value) {
        continuation?.resume(returning: value)
        continuation = nil
    }
}
