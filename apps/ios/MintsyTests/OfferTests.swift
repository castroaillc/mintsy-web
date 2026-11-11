import Foundation
import Testing
@testable import Mintsy

/// What the paywall says, worked out from the store's products.
struct OfferTests {
    private func package(
        _ kind: PlanKind, price: Decimal, priceString: String, perMonth: String? = nil, intro: IntroOffer? = nil, eligible: Bool = true
    ) -> StorePackage {
        StorePackage(
            kind: kind, productID: kind.productID, price: price, priceString: priceString, perMonthString: perMonth,
            intro: intro, isIntroEligible: eligible
        )
    }

    private let weekFree = IntroOffer(isFree: true, unit: .week, value: 1, cycles: 1)

    @Test(arguments: [
        (Decimal(string: "59.99")!, Decimal(string: "9.99")!, 50 as Int?),
        (Decimal(60), Decimal(10), 50),
        (Decimal(90), Decimal(10), 25),
        (Decimal(string: "39.99")!, Decimal(string: "5.99")!, 44),
        // Not a saving, or not known
        (Decimal(120), Decimal(10), nil),
        (Decimal(130), Decimal(10), nil),
        (Decimal(0), Decimal(10), nil),
        (Decimal(60), Decimal(0), nil),
    ])
    func savingsCompareTheYearlyPriceWithTwelveMonths(yearly: Decimal, monthly: Decimal, expected: Int?) {
        #expect(Offer.savingsPercent(yearly: yearly, monthly: monthly) == expected)
    }

    @Test func aFreeIntroductoryOfferIsATrialWithItsLength() {
        #expect(TrialLength(weekFree) == TrialLength(count: 1, unit: .week))
        #expect(TrialLength(IntroOffer(isFree: true, unit: .day, value: 7, cycles: 1))?.noun == "7 days")
        #expect(TrialLength(IntroOffer(isFree: true, unit: .day, value: 7, cycles: 1))?.adjective == "7-day")
        #expect(TrialLength(weekFree)?.noun == "1 week")
        #expect(TrialLength(weekFree)?.adjective == "1-week")
        #expect(TrialLength(IntroOffer(isFree: true, unit: .month, value: 1, cycles: 3))?.noun == "3 months")
    }

    @Test func aPaidIntroductoryPriceOrNoOfferIsNotATrial() {
        #expect(TrialLength(IntroOffer(isFree: false, unit: .month, value: 1, cycles: 3)) == nil)
        #expect(TrialLength(IntroOffer(isFree: true, unit: .day, value: 0, cycles: 1)) == nil)
        #expect(TrialLength(nil) == nil)
    }

    @Test func anOfferCarriesTheStoresPricesAndTheSaving() throws {
        let offer = try Offer.make(from: [
            package(.monthly, price: 10, priceString: "10,00 €", perMonth: "10,00 €"),
            package(.yearly, price: 60, priceString: "60,00 €", perMonth: "5,00 €", intro: weekFree),
        ])
        #expect(offer.plans.map(\.kind) == [.yearly, .monthly])
        #expect(offer.savingsPercent == 50)
        #expect(offer.yearly?.priceString == "60,00 €")
        #expect(offer.yearly?.billingNote == "Just 5,00 €/month, billed yearly")
        #expect(offer.yearly?.pricePerPeriod == "60,00 €/year")
        #expect(offer.yearly?.trial == TrialLength(count: 1, unit: .week))
        #expect(offer.monthly?.billingNote == "Billed every month")
        #expect(offer.monthly?.perMonthString == nil)
        #expect(offer.monthly?.trial == nil)
    }

    @Test func aTrialOnlyShowsWhenTheAppleAccountCanStillTakeIt() throws {
        let offer = try Offer.make(from: [package(.yearly, price: 60, priceString: "$60.00", intro: weekFree, eligible: false)])
        #expect(offer.yearly?.trial == nil)
        #expect(offer.monthly == nil)
        #expect(offer.savingsPercent == nil)
        #expect(offer.yearly?.billingNote == "Billed every year")
    }

    @Test func noProductsIsAnError() {
        #expect(throws: PurchasesError.noPlans) { try Offer.make(from: []) }
    }

    @Test func theButtonAndTermsFollowTheTrial() throws {
        let offer = try Offer.make(from: [
            package(.yearly, price: 60, priceString: "$60.00", intro: weekFree),
            package(.monthly, price: 10, priceString: "$10.00"),
        ])
        #expect(PaywallModel.callToAction(for: offer.yearly) == "Start 1-week free trial")
        #expect(PaywallModel.callToAction(for: offer.monthly) == "Continue")
        #expect(PaywallModel.callToAction(for: nil) == "Continue")
        #expect(PaywallModel.finePrint(for: offer.yearly) == "Free for 1 week, then $60.00/year. \(PaywallModel.renewalTerms)")
        #expect(PaywallModel.finePrint(for: offer.monthly) == "$10.00/month. \(PaywallModel.renewalTerms)")
        #expect(PaywallModel.finePrint(for: nil) == PaywallModel.renewalTerms)
        #expect(PaywallModel.renewalTerms.contains("Renews automatically"))
    }

    @Test func plansAreKnownByTheirAppStoreProducts() {
        #expect(PlanKind(productID: "mintsy_premium_yearly") == .yearly)
        #expect(PlanKind(productID: "mintsy_premium_monthly") == .monthly)
        #expect(PlanKind(productID: "something_else") == nil)
        #expect(PlanKind(productID: nil) == nil)
    }

    @Test func theAPIsStateBecomesAPlanStatus() throws {
        func premium(active: Bool = true, expiresAt: String? = "2027-01-01T00:00:00.000Z", willRenew: Bool = true, periodType: String? = "normal", store: String? = "app_store") -> Premium {
            Premium(active: active, expiresAt: expiresAt, willRenew: willRenew, periodType: periodType, productId: "mintsy_premium_yearly", store: store)
        }
        let date = try #require(ISODate.parse("2027-01-01T00:00:00.000Z"))
        #expect(premium().status == .active(renews: date))
        #expect(premium(periodType: "trial").status == .trial(ends: date))
        #expect(premium(willRenew: false, periodType: "trial").status == .ending(date))
        #expect(premium(willRenew: false).status == .ending(date))
        #expect(premium(expiresAt: nil, willRenew: false).status == .active(renews: nil))
        #expect(premium(active: false).status == nil)
        #expect(Premium.none.status == nil)
        #expect(premium().planKind == .yearly)
        #expect(premium(store: "stripe").isWebStore && premium(store: "rc_billing").isWebStore)
        #expect(premium().isAppStore && !premium().isWebStore)
        #expect(premium(store: "play_store").storeName == "Google Play")
    }
}
