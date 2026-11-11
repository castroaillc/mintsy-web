import Foundation
import StoreKitTest
import Testing
@testable import Mintsy

/// The real StoreKit 2 client against the test products in `StoreKit/Mintsy.storekit` (StoreKit Testing in Xcode:
/// no App Store Connect, no network). The prices here are that file's test values.
@Suite(.serialized)
struct StoreKitPurchasesTests {
    private func session() throws -> SKTestSession {
        let session = try SKTestSession(configurationFileNamed: "Mintsy")
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        return session
    }

    @Test func loadsBothPlansWithTheStoresPricesAndTrial() async throws {
        _ = try session()
        let client = StoreKitPurchases()
        let offer = try Offer.make(from: try await client.packages())
        let yearly = try #require(offer.yearly)
        let monthly = try #require(offer.monthly)
        #expect(yearly.productID == "mintsy_premium_yearly")
        #expect(monthly.productID == "mintsy_premium_monthly")
        #expect(yearly.priceString.contains("59.99"))
        #expect(monthly.priceString.contains("9.99"))
        #expect(yearly.perMonthString?.contains("5.00") == true)
        #expect(offer.savingsPercent == 50)
        // A new Apple Account can take the one-week free trial
        #expect(yearly.trial == TrialLength(count: 1, unit: .week))
        #expect(monthly.trial == TrialLength(count: 1, unit: .week))
    }

    @Test func aPurchaseCarriesTheAccountTokenAndBecomesAnEntitlement() async throws {
        _ = try session()
        let client = StoreKitPurchases()
        _ = try await client.packages()
        let token = UUID()
        let result = try await client.purchase(.yearly, appAccountToken: token)
        guard case .purchased(let transaction) = result else {
            Issue.record("Expected a purchase, got \(result)")
            return
        }
        #expect(transaction.productID == "mintsy_premium_yearly")
        #expect(transaction.appAccountToken == token)
        // A JWS: header.payload.signature
        #expect(transaction.signedTransaction.split(separator: ".").count == 3)

        let entitlements = await client.currentEntitlements()
        #expect(entitlements.map(\.productID) == ["mintsy_premium_yearly"])
        #expect(entitlements.first?.appAccountToken == token)
        await client.finish(transaction)

        // The trial is used up: no second one for this Apple Account
        let again = try Offer.make(from: try await client.packages())
        #expect(again.yearly?.trial == nil)
        #expect(again.monthly?.trial == nil)
    }

    @Test func buyingBeforeThePlansLoadedIsRefused() async throws {
        _ = try session()
        let client = StoreKitPurchases()
        await #expect(throws: PurchasesError.noPlans) { try await client.purchase(.monthly, appAccountToken: UUID()) }
    }
}
