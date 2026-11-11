import Foundation
import OSLog
import StoreKit

/// StoreKit 2. Listens to `Transaction.updates` from the moment it's made (app launch), and keeps each verified
/// transaction until the API has accepted it and it can be finished.
final class StoreKitPurchases: PurchasesClient {
    let transactionUpdates: AsyncStream<StoreTransaction>

    private let updates: AsyncStream<StoreTransaction>.Continuation
    /// The products of the last `packages()` answer, to buy from.
    private var products: [PlanKind: Product] = [:]
    /// Verified transactions that haven't been finished, by id.
    private var unfinished: [UInt64: Transaction] = [:]
    private var listener: Task<Void, Never>?
    private let log = Logger(subsystem: "com.getmintsy.app", category: "purchases")

    init() {
        (transactionUpdates, updates) = AsyncStream.makeStream()
        listener = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if let transaction = accept(result) {
                    updates.yield(transaction)
                }
            }
        }
    }

    isolated deinit {
        listener?.cancel()
    }

    func packages() async throws(PurchasesError) -> [StorePackage] {
        guard AppStore.canMakePayments else { throw .unavailable }
        let found: [Product]
        do {
            found = try await Product.products(for: PlanKind.allCases.map(\.productID))
        } catch {
            throw failure(error, during: "products")
        }
        var products: [PlanKind: Product] = [:]
        var packages: [StorePackage] = []
        for kind in PlanKind.allCases {
            guard let product = found.first(where: { $0.id == kind.productID }), let subscription = product.subscription else { continue }
            products[kind] = product
            packages.append(StorePackage(
                kind: kind,
                productID: product.id,
                price: product.price,
                priceString: product.displayPrice,
                perMonthString: Self.perMonthString(product, period: subscription.subscriptionPeriod),
                intro: subscription.introductoryOffer.flatMap(Self.introOffer),
                // The App Store knows whether this Apple Account already used the group's introductory offer
                isIntroEligible: await subscription.isEligibleForIntroOffer
            ))
        }
        guard !packages.isEmpty else { throw .noPlans }
        self.products = products
        return packages
    }

    func purchase(_ kind: PlanKind, appAccountToken: UUID) async throws(PurchasesError) -> StorePurchase {
        guard let product = products[kind] else { throw .noPlans }
        let result: Product.PurchaseResult
        do {
            result = try await product.purchase(options: [.appAccountToken(appAccountToken)])
        } catch {
            throw failure(error, during: "purchase")
        }
        switch result {
        case .success(let verification):
            guard let transaction = accept(verification) else { throw .store("The transaction couldn't be verified") }
            return .purchased(transaction)
        case .userCancelled:
            return .cancelled
        case .pending:
            return .pending
        @unknown default:
            throw .store("Unknown purchase result")
        }
    }

    func currentEntitlements() async -> [StoreTransaction] {
        var transactions: [StoreTransaction] = []
        for await result in Transaction.currentEntitlements {
            if let transaction = accept(result) {
                transactions.append(transaction)
            }
        }
        return transactions
    }

    func sync() async throws(PurchasesError) {
        do {
            try await AppStore.sync()
        } catch StoreKitError.userCancelled {
            throw .cancelled
        } catch {
            throw failure(error, during: "sync")
        }
    }

    func finish(_ transaction: StoreTransaction) async {
        await unfinished.removeValue(forKey: transaction.id)?.finish()
    }

    /// A transaction StoreKit verified, for one of the plans; anything else is dropped. The API verifies the
    /// signature again for itself.
    private func accept(_ result: VerificationResult<Transaction>) -> StoreTransaction? {
        switch result {
        case .unverified(let transaction, let error):
            log.error("Unverified transaction \(transaction.id): \(error.localizedDescription, privacy: .public)")
            return nil
        case .verified(let transaction):
            guard PlanKind(productID: transaction.productID) != nil else { return nil }
            unfinished[transaction.id] = transaction
            return StoreTransaction(
                id: transaction.id,
                productID: transaction.productID,
                signedTransaction: result.jwsRepresentation,
                appAccountToken: transaction.appAccountToken
            )
        }
    }

    private func failure(_ error: any Error, during step: String) -> PurchasesError {
        log.error("\(step, privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
        return .store(error.localizedDescription)
    }

    /// The price spread over the months of a period longer than a month, in the store's currency format.
    private static func perMonthString(_ product: Product, period: Product.SubscriptionPeriod) -> String? {
        let months: Int
        switch period.unit {
        case .year: months = period.value * 12
        case .month: months = period.value
        default: return nil
        }
        guard months > 1 else { return nil }
        return (product.price / Decimal(months)).formatted(product.priceFormatStyle)
    }

    private static func introOffer(_ offer: Product.SubscriptionOffer) -> IntroOffer? {
        let unit: PeriodUnit
        switch offer.period.unit {
        case .day: unit = .day
        case .week: unit = .week
        case .month: unit = .month
        case .year: unit = .year
        @unknown default: return nil
        }
        return IntroOffer(isFree: offer.paymentMode == .freeTrial, unit: unit, value: offer.period.value, cycles: offer.periodCount)
    }
}
