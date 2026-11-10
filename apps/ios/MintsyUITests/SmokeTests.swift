import XCTest

/// Signs in against a running API and walks Home → Book → Player, saving a screenshot of each. Skipped unless
/// credentials are given, because it needs a backend with an account and a published catalog:
///
///     TEST_RUNNER_MINTSY_EMAIL=… TEST_RUNNER_MINTSY_PASSWORD=… TEST_RUNNER_MINTSY_SCREENSHOTS=/tmp/shots \
///       xcodebuild test -scheme "Mintsy Dev" -only-testing:MintsyUITests …
final class SmokeTests: XCTestCase {
    private var screenshotFolder: URL? {
        ProcessInfo.processInfo.environment["MINTSY_SCREENSHOTS"].map { URL(filePath: $0) }
    }

    @MainActor
    func testSignInBrowseAndPlay() throws {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["MINTSY_EMAIL"], let password = env["MINTSY_PASSWORD"] else {
            throw XCTSkip("Set TEST_RUNNER_MINTSY_EMAIL and TEST_RUNNER_MINTSY_PASSWORD to run against a backend")
        }
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()

        let emailField = app.textFields["Email"]
        if emailField.waitForExistence(timeout: 5) {
            emailField.tap()
            emailField.typeText(email)
            let passwordField = app.secureTextFields["Password"]
            passwordField.tap()
            passwordField.typeText(password)
            app.buttons["Sign in"].firstMatch.tap()
        }

        dismissSavePassword(app)
        XCTAssertTrue(app.buttons["Play Episode 1"].waitForExistence(timeout: 15), "Home didn't load the catalog")
        sleep(2) // covers load
        save(app, "02-home")

        app.buttons["Open The Science of Getting Rich"].firstMatch.tap()
        let play = app.buttons["Play Episode 1 of 5"]
        XCTAssertTrue(play.waitForExistence(timeout: 5))
        sleep(1)
        save(app, "03-book")

        app.swipeUp()
        sleep(1)
        save(app, "04-book-episodes")
        app.swipeDown()

        play.tap()
        XCTAssertTrue(app.staticTexts["Episode 1 of 5"].waitForExistence(timeout: 10))
        sleep(8) // starts playing; voices arrive
        save(app, "05-player")

        // Controls fade while playing: tap the picture to bring them back, then turn captions on
        let showCaptions = app.buttons["Show captions"]
        if !showCaptions.isHittable {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
        }
        XCTAssertTrue(showCaptions.waitForExistence(timeout: 3))
        showCaptions.tap()
        XCTAssertTrue(app.buttons["Hide captions"].waitForExistence(timeout: 3), "Captions didn't turn on")
        sleep(1)
        save(app, "05b-player-controls-captions")
        sleep(5) // controls fade; the caption drops to the bottom edge
        save(app, "05c-player-captions")

        let narrator = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Narrator'")).firstMatch
        XCTAssertTrue(narrator.waitForExistence(timeout: 10), "No narrator picker")
        narrator.tap()
        sleep(1)
        save(app, "06-player-narrators")
        app.buttons["Michael"].firstMatch.tap()
        sleep(6)
        save(app, "07-player-michael")
    }

    /// The system's "Save Password?" sheet after the first sign-in.
    @MainActor
    private func dismissSavePassword(_ app: XCUIApplication) {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for candidate in [app.buttons["Not Now"], springboard.buttons["Not Now"]] where candidate.waitForExistence(timeout: 4) {
            candidate.tap()
            return
        }
    }

    @MainActor
    private func save(_ app: XCUIApplication, _ name: String) {
        let shot = app.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let screenshotFolder {
            try? shot.pngRepresentation.write(to: screenshotFolder.appending(path: "\(name).png"))
        }
    }
}
