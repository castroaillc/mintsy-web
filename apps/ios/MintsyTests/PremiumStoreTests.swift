import Foundation
import Testing
@testable import Mintsy

/// The Premium store and the paywall's model against a scripted App Store and API.
struct PremiumStoreTests {
    private final class Counter {
        var count = 0
    }

    private struct Rig {
        let store: PremiumStore
        let purchases: FakePurchases
        let api: FakePremiumAPI
        let catalogReloads: Counter
    }

    private func rig(signedIn: Bool = true) async -> Rig {
        let purchases = FakePurchases()
        let api = FakePremiumAPI()
        let reloads = Counter()
        let store = PremiumStore(api: api, purchases: purchases, retryDelay: .zero) { reloads.count += 1 }
        if signedIn { await store.setUser("user-1") }
        return Rig(store: store, purchases: purchases, api: api, catalogReloads: reloads)
    }

    private func yearly(_ rig: Rig) async throws -> Plan {
        try #require(try await rig.store.loadOffer().yearly)
    }

    // MARK: Purchase

    @Test func aPurchaseIsBoughtForTheAccountSentToTheAPIThenFinished() async throws {
        let rig = await rig()
        let outcome = try await rig.store.purchase(try await yearly(rig))
        #expect(outcome == .purchased)
        #expect(rig.purchases.purchases.first?.kind == .yearly)
        #expect(rig.purchases.purchases.first?.token == rig.api.token)
        #expect(rig.api.synced == ["jws-100"])
        #expect(rig.purchases.finished == [100])
        #expect(rig.store.isPremium)
        #expect(rig.store.premium.periodType == "trial")
        // Locks and media URLs come from the catalog, refetched once Premium turned on
        #expect(rig.catalogReloads.count == 1)
    }

    @Test func aCancelledPurchaseChangesNothing() async throws {
        let rig = await rig()
        rig.purchases.purchaseResult = .success(.cancelled)
        #expect(try await rig.store.purchase(try await yearly(rig)) == .cancelled)
        #expect(rig.api.synced.isEmpty)
        #expect(!rig.store.isPremium)
        #expect(rig.catalogReloads.count == 0)
    }

    @Test func aPurchaseWaitingForApprovalSaysSo() async throws {
        let rig = await rig()
        rig.purchases.purchaseResult = .success(.pending)
        let plan = try await yearly(rig)
        await #expect(throws: PurchasesError.pending) { try await rig.store.purchase(plan) }
        #expect(!rig.store.isPremium)
    }

    @Test func aPurchaseTheAPIDoesNotTakeStaysUnfinished() async throws {
        let rig = await rig()
        rig.api.stateAfterSync = nil
        let plan = try await yearly(rig)
        await #expect(throws: PurchasesError.notActivated) { try await rig.store.purchase(plan) }
        // Offered twice, never finished: the App Store delivers it again later
        #expect(rig.api.synced == ["jws-100", "jws-100"])
        #expect(rig.purchases.finished.isEmpty)
        #expect(!rig.store.isPremium)
        #expect(rig.catalogReloads.count == 0)
    }

    @Test func aPurchaseIsOfferedToTheAPIASecondTime() async throws {
        let rig = await rig()
        rig.api.refusals = 1
        #expect(try await rig.store.purchase(try await yearly(rig)) == .purchased)
        #expect(rig.api.synced.count == 2)
        #expect(rig.purchases.finished == [100])
    }

    @Test func aStoreFailureIsThrown() async throws {
        let rig = await rig()
        rig.purchases.purchaseResult = .failure(.store("network"))
        let plan = try await yearly(rig)
        await #expect(throws: PurchasesError.store("network")) { try await rig.store.purchase(plan) }
    }

    @Test func nothingIsSoldWithoutAnAccount() async {
        let signedOut = await rig(signedIn: false)
        await #expect(throws: PurchasesError.accountUnavailable) { try await signedOut.store.loadOffer() }

        let noToken = FakePremiumAPI()
        noToken.token = nil
        let purchases = FakePurchases()
        let store = PremiumStore(api: noToken, purchases: purchases, retryDelay: .zero) {}
        await store.setUser("user-1")
        await #expect(throws: PurchasesError.accountUnavailable) { try await store.loadOffer() }
        let plan = Plan(kind: .yearly, productID: "mintsy_premium_yearly", priceString: "$60.00", perMonthString: nil, trial: nil)
        await #expect(throws: PurchasesError.accountUnavailable) { try await store.purchase(plan) }
        #expect(purchases.purchases.isEmpty)
    }

    // MARK: Restore

    @Test func restoreSyncsWithTheAppStoreAndOffersEverySubscription() async throws {
        let rig = await rig()
        // Bought under another mintsy account: only an explicit restore offers it, and the API decides
        rig.purchases.entitlementsAfterSync = [FakePurchases.transaction(7, token: UUID())]
        #expect(try await rig.store.restore())
        #expect(rig.purchases.syncCount == 1)
        #expect(rig.api.synced == ["jws-7"])
        #expect(rig.purchases.finished == [7])
        #expect(rig.catalogReloads.count == 1)
    }

    @Test func restoreWithNothingToRestoreIsNotAnError() async throws {
        let rig = await rig()
        #expect(try await rig.store.restore() == false)
        #expect(rig.purchases.syncCount == 1)
        #expect(rig.api.synced.isEmpty)
    }

    @Test func restoreFailsWhenTheAPITakesNone() async {
        let rig = await rig()
        rig.purchases.entitlementsAfterSync = [FakePurchases.transaction(7, token: nil)]
        rig.api.stateAfterSync = nil
        await #expect(throws: PurchasesError.notActivated) { try await rig.store.restore() }
        #expect(rig.purchases.finished.isEmpty)
    }

    // MARK: Sign-in, sign-out and updates

    @Test func signingInLoadsTheAPIsStateAndHandsItTheAccountsSubscriptions() async {
        let purchases = FakePurchases()
        let api = FakePremiumAPI()
        let token = UUID()
        api.token = token
        purchases.entitlements = [
            FakePurchases.transaction(1, token: token),
            FakePurchases.transaction(2, .monthly, token: nil),
            // Another mintsy account's purchase on the same Apple Account is left alone
            FakePurchases.transaction(3, token: UUID()),
        ]
        let reloads = Counter()
        let store = PremiumStore(api: api, purchases: purchases, retryDelay: .zero) { reloads.count += 1 }
        await store.setUser("user-1")
        #expect(api.synced == ["jws-1", "jws-2"])
        #expect(purchases.finished == [1, 2])
        #expect(store.isPremium)
        #expect(reloads.count == 1)
    }

    @Test func signingInToAPremiumAccountDoesNotReloadTheCatalog() async {
        let purchases = FakePurchases()
        let api = FakePremiumAPI()
        api.state = FakePremiumAPI.active
        let reloads = Counter()
        let store = PremiumStore(api: api, purchases: purchases, retryDelay: .zero) { reloads.count += 1 }
        await store.setUser("user-1")
        #expect(store.isPremium)
        #expect(api.synced.isEmpty)
        #expect(reloads.count == 0)
    }

    @Test func signingOutForgetsPremium() async throws {
        let rig = await rig()
        _ = try await rig.store.purchase(try await yearly(rig))
        await rig.store.setUser(nil)
        #expect(!rig.store.isPremium)
        #expect(rig.store.premium == .none)
        await #expect(throws: PurchasesError.accountUnavailable) { try await rig.store.loadOffer() }
    }

    @Test func aTransactionTheAppStoreDeliversIsSentToTheAPI() async throws {
        let rig = await rig()
        rig.purchases.updates.yield(FakePurchases.transaction(9, token: rig.api.token))
        try await waitUntil { rig.purchases.finished == [9] }
        #expect(rig.api.synced == ["jws-9"])
        #expect(rig.store.isPremium)
        #expect(rig.catalogReloads.count == 1)
    }

    @Test func aTransactionDeliveredBeforeSignInWaitsForIt() async throws {
        let rig = await rig(signedIn: false)
        let token = try #require(rig.api.token)
        rig.purchases.updates.yield(FakePurchases.transaction(9, token: token))
        try await Task.sleep(for: .milliseconds(50))
        #expect(rig.api.synced.isEmpty)
        await rig.store.setUser("user-1")
        #expect(rig.api.synced == ["jws-9"])
        #expect(rig.purchases.finished == [9])
    }

    @Test func refreshAsksTheAPIAgainAndRefetchesTheCatalog() async {
        let rig = await rig()
        rig.api.state = FakePremiumAPI.active
        await rig.store.refresh()
        #expect(rig.api.refreshCount == 1)
        #expect(rig.store.isPremium)
        #expect(rig.catalogReloads.count == 1)
    }

    // MARK: The paywall's model

    @Test func thePaywallLoadsThePlansAndBuysThePickedOne() async {
        let rig = await rig()
        let model = PaywallModel(premium: rig.store)
        #expect(await model.load() == false)
        #expect(model.offer?.savingsPercent == 50)
        #expect(model.selectedPlan?.kind == .yearly)
        #expect(model.callToAction == "Start 1-week free trial")
        model.selection = .monthly
        #expect(model.callToAction == "Continue")
        #expect(model.finePrint.hasPrefix("$10.00/month."))
        #expect(await model.buy())
        #expect(rig.purchases.purchases.first?.kind == .monthly)
        #expect(model.notice == nil)
        #expect(model.activity == nil)
    }

    @Test func aCancelledPurchaseShowsNothingAndOtherFailuresAMessage() async {
        let rig = await rig()
        let model = PaywallModel(premium: rig.store)
        await model.load()
        rig.purchases.purchaseResult = .success(.cancelled)
        #expect(await model.buy() == false)
        #expect(model.notice == nil)

        rig.purchases.purchaseResult = .success(.pending)
        #expect(await model.buy() == false)
        #expect(model.notice?.title == "Waiting for approval")

        rig.purchases.purchaseResult = .failure(.store("SKError 2"))
        #expect(await model.buy() == false)
        #expect(model.notice?.title == "Purchase didn’t go through")
        // Never the store's raw error
        #expect(model.notice?.message.contains("SKError") == false)
    }

    @Test func thePaywallPicksThePlanTheStoreHas() async {
        let rig = await rig()
        rig.purchases.storePackages.removeFirst()
        let model = PaywallModel(premium: rig.store)
        await model.load()
        #expect(model.selection == .monthly)
        #expect(model.offer?.savingsPercent == nil)
    }

    @Test func plansThatCannotLoadShowARetryState() async {
        let rig = await rig()
        rig.purchases.packagesError = .store("offline")
        let model = PaywallModel(premium: rig.store)
        await model.load()
        #expect(model.phase == .unavailable("We couldn’t load the plans right now."))
        #expect(model.selectedPlan == nil)
        #expect(await model.buy() == false)

        rig.purchases.packagesError = nil
        await model.load()
        #expect(model.offer != nil)
    }

    @Test func restoringFromThePaywall() async {
        let rig = await rig()
        let model = PaywallModel(premium: rig.store)
        await model.load()
        #expect(await model.restore() == false)
        #expect(model.notice == .nothingToRestore)

        model.notice = nil
        rig.purchases.syncError = .cancelled
        #expect(await model.restore() == false)
        #expect(model.notice == nil)

        rig.purchases.syncError = .store("offline")
        #expect(await model.restore() == false)
        #expect(model.notice?.title == "Couldn’t restore purchases")

        model.notice = nil
        rig.purchases.syncError = nil
        rig.purchases.entitlementsAfterSync = [FakePurchases.transaction(7, token: rig.api.token)]
        #expect(await model.restore())
        #expect(model.notice == nil)
    }

    @Test func aSubscriberSentToThePaywallSkipsIt() async {
        let rig = await rig()
        rig.api.state = FakePremiumAPI.active
        await rig.store.setUser("user-1")
        let model = PaywallModel(premium: rig.store)
        #expect(await model.load())
        // The lock that led here was stale
        #expect(rig.catalogReloads.count == 1)
    }

    // MARK: Entry points

    @Test func aLockedEpisodeOpensThePaywallInsteadOfPlaying() {
        let presenter = PlayerPresenter()
        let free = Episode(id: "b-1", number: 1, title: "One", summary: "", durationSec: 60, transcript: [], takeaways: [], locked: false)
        let locked = Episode(id: "b-4", number: 4, title: "Four", summary: "", durationSec: 60, transcript: [], takeaways: [], locked: true)

        presenter.open(locked)
        #expect(presenter.route == nil)
        #expect(presenter.paywall == PaywallRoute(episodeID: "b-4"))

        // Welcome to Premium's Play button: the player opens once the paywall has closed
        presenter.playAfterPaywall(free)
        #expect(presenter.paywall == nil && presenter.route == nil)
        presenter.paywallDismissed()
        #expect(presenter.route?.episodeID == "b-1")

        // With the player open, the paywall goes over it
        presenter.showPaywall(for: locked)
        #expect(presenter.playerPaywall == PaywallRoute(episodeID: "b-4"))
        #expect(presenter.paywall == nil)

        presenter.goHome()
        #expect(presenter.route == nil && presenter.playerPaywall == nil)
        #expect(presenter.homeRequests == 1)
    }

    private func waitUntil(_ condition: () -> Bool) async throws {
        for _ in 0..<200 where !condition() {
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(condition())
    }
}
