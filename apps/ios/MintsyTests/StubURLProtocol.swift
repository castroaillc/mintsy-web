import Foundation
import Synchronization

/// Answers requests from canned responses, keyed by host, so tests can run in parallel with their own host.
nonisolated final class StubURLProtocol: URLProtocol {
    struct Reply: Sendable {
        var status: Int = 200
        var headers: [String: String] = ["Content-Type": "application/json"]
        var body: Data
    }

    /// A request the stub saw, for assertions.
    struct Seen: Sendable {
        let url: URL
        let method: String
        let headers: [String: String]
        let body: Data?
    }

    private static let replies = Mutex<[String: @Sendable (Seen) -> Reply]>([:])
    private static let seen = Mutex<[String: [Seen]]>([:])

    static func register(host: String, _ reply: @escaping @Sendable (Seen) -> Reply) {
        replies.withLock { $0[host] = reply }
    }

    static func requests(for host: String) -> [Seen] {
        seen.withLock { $0[host] ?? [] }
    }

    static func session() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url, let host = url.host() else { return }
        let seen = Seen(url: url, method: request.httpMethod ?? "GET", headers: request.allHTTPHeaderFields ?? [:], body: Self.bodyData(of: request))
        Self.seen.withLock { $0[host, default: []].append(seen) }
        guard let handler = Self.replies.withLock({ $0[host] }) else {
            client?.urlProtocol(self, didFailWithError: URLError(.cannotFindHost))
            return
        }
        let reply = handler(seen)
        let response = HTTPURLResponse(url: url, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: reply.headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: reply.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    /// URLSession moves the body to a stream before a protocol sees it.
    private static func bodyData(of request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            guard read > 0 else { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
