import Foundation
import Observation
import OSLog

/// The signed-in viewer's Premium: the API's state (`me.premium`), which decides what's locked, and the App Store
/// purchases that change it. Every verified transaction is handed to the API (`syncAppStoreTransaction`) and only
/// finished once the API accepted it; when the answer changes whether Premium is active, the catalog is refetched so
/// `Episode.locked` and the media URLs follow. Nothing is ever unlocked from the App Store's state alone.
@Observable
final class PremiumStore {
    /// What the API last said. `.none` until it answers, and when signed out.
    private(set) var premium = Premium.none

    @ObservationIgnored private let api: any PremiumAPI
    @ObservationIgnored private let purchases: any PurchasesClient
    @ObservationIgnored private let reloadCatalog: () async -> Void
    /// How long to wait before offering the API a purchase once more when it didn't take it.
    @ObservationIgnored private let retryDelay: Duration
    @ObservationIgnored private var userID: String?
    /// The signed-in account's App Store token (`me.appAccountToken`), once the API gave it.
    @ObservationIgnored private var accountToken: UUID?
    /// Transactions the App Store delivered while nobody was signed in (launch), kept for the sign-in.
    @ObservationIgnored private var waiting: [StoreTransaction] = []
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var listener: Task<Void, Never>?
    @ObservationIgnored private let log = Logger(subsystem: "com.getmintsy.app", category: "premium")

    init(
        api: any PremiumAPI,
        purchases: any PurchasesClient,
        retryDelay: Duration = .seconds(2),
        reloadCatalog: @escaping () async -> Void
    ) {
        self.api = api
        self.purchases = purchases
        self.retryDelay = retryDelay
        self.reloadCatalog = reloadCatalog
        let updates = purchases.transactionUpdates
        listener = Task { [weak self] in
            for await transaction in updates {
                await self?.transactionArrived(transaction)
            }
        }
    }

    isolated deinit {
        listener?.cancel()
    }

    /// Premium according to the API.
    var isPremium: Bool { premium.active }

    // MARK: Who's signed in

    /// Follows the session. Signed in: loads the account's Premium and App Store token, then hands the API whatever
    /// the App Store has for it. Signed out (nil): forgets everything. There's no purchase without an account.
    func setUser(_ id: String?) async {
        generation += 1
        let generation = generation
        userID = id
        accountToken = nil
        premium = .none
        guard id != nil else { return }

        async let state = try? api.premium()
        async let token = try? api.appAccountToken()
        let (loaded, loadedToken) = await (state, token)
        guard generation == self.generation else { return }
        if let loaded {
            premium = loaded
        }
        accountToken = loadedToken
        await syncEntitlements()
    }

    // MARK: Keeping the API up to date

    /// The App Store delivered a transaction by itself: a renewal, an approved Ask to Buy purchase, one left unfinished.
    private func transactionArrived(_ transaction: StoreTransaction) async {
        guard userID != nil, accountToken != nil else {
            waiting.append(transaction)
            return
        }
        await deliver(transaction)
    }

    /// Hands the API the Apple Account's active subscriptions and anything that arrived before sign-in. Transactions
    /// bought for another mintsy account are left alone here; Restore purchases is how those are offered.
    private func syncEntitlements() async {
        guard let accountToken else { return }
        var transactions = waiting
        waiting = []
        for transaction in await purchases.currentEntitlements() where !transactions.contains(transaction) {
            transactions.append(transaction)
        }
        for transaction in transactions where transaction.appAccountToken == nil || transaction.appAccountToken == accountToken {
            await deliver(transaction)
        }
    }

    /// Sends one transaction to the API and finishes it once accepted. False when the API didn't take it: it stays
    /// unfinished, so the App Store delivers it again on the next launch.
    @discardableResult
    private func deliver(_ transaction: StoreTransaction) async -> Bool {
        let generation = generation
        do {
            let state = try await api.syncAppStoreTransaction(transaction.signedTransaction)
            guard generation == self.generation else { return false }
            await purchases.finish(transaction)
            await apply(state)
            return true
        } catch {
            log.error("syncAppStoreTransaction failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    /// Takes the API's answer; the catalog is refetched when it changes what's unlocked.
    private func apply(_ state: Premium) async {
        let changed = state.active != premium.active
        premium = state
        if changed {
            await reloadCatalog()
        }
    }

    /// Has the API look at the subscription again and refetches the catalog (pull to refresh, a stale lock, the
    /// manage-subscriptions sheet closing).
    func refresh() async {
        guard userID != nil else { return }
        let generation = generation
        await syncEntitlements()
        if let state = try? await api.refreshPremium(), generation == self.generation {
            premium = state
        }
        guard generation == self.generation else { return }
        await reloadCatalog()
    }

    // MARK: Buying

    /// The plans on sale, with the store's prices. Needs the account's token, because nothing is sold without one.
    func loadOffer() async throws(PurchasesError) -> Offer {
        _ = try await token()
        return try Offer.make(from: await purchases.packages())
    }

    /// Buys a plan for this account and hands the purchase to the API. `.cancelled` when the viewer backed out;
    /// throws on any failure, `.pending` when it waits for approval.
    func purchase(_ plan: Plan) async throws(PurchasesError) -> PurchaseOutcome {
        let token = try await token()
        switch try await purchases.purchase(plan.kind, appAccountToken: token) {
        case .cancelled:
            return .cancelled
        case .pending:
            throw .pending
        case .purchased(let transaction):
            if await !deliver(transaction) {
                try? await Task.sleep(for: retryDelay)
                await deliver(transaction)
            }
            guard premium.active else { throw .notActivated }
            return .purchased
        }
    }

    /// Restore purchases: has the App Store resend the Apple Account's transactions, then offers the API every
    /// active subscription. True when Premium is active afterwards.
    func restore() async throws(PurchasesError) -> Bool {
        _ = try await token()
        try await purchases.sync()
        let transactions = await purchases.currentEntitlements()
        waiting = []
        var accepted = transactions.isEmpty
        for transaction in transactions {
            if await deliver(transaction) { accepted = true }
        }
        guard accepted else { throw .notActivated }
        return premium.active
    }

    /// The account's App Store token, asked for again when the API hasn't given it yet.
    private func token() async throws(PurchasesError) -> UUID {
        if let accountToken { return accountToken }
        guard let userID else { throw .accountUnavailable }
        guard let token = try? await api.appAccountToken(), userID == self.userID else { throw .accountUnavailable }
        accountToken = token
        return token
    }
}
