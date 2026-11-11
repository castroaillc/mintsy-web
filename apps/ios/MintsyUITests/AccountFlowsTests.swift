import XCTest

/// Walks milestone 2 against a local API with a fresh account, saving a screenshot at each step: Welcome, sign-up,
/// My List and progress, search, profile, edit name, change password, change email (through the emailed link), sign
/// out, forgot and reset password (through the emailed link), and delete account. Skipped unless pointed at a
/// backend whose log shows the emails (no RESEND_API_KEY), because the links come from there:
///
///     TEST_RUNNER_MINTSY_FLOWS_LOG=/path/to/backend.log TEST_RUNNER_MINTSY_SCREENSHOTS=/tmp/shots \
///       xcodebuild test -scheme "Mintsy Dev" -only-testing:MintsyUITests/AccountFlowsTests …
///
/// Never point it at a shared API: it creates and deletes an account.
final class AccountFlowsTests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var screenshotFolder: URL? { env["MINTSY_SCREENSHOTS"].map { URL(filePath: $0) } }

    @MainActor
    func testAccountsAndLibrary() throws {
        guard let logPath = env["MINTSY_FLOWS_LOG"] else {
            throw XCTSkip("Set TEST_RUNNER_MINTSY_FLOWS_LOG to a local backend's log to run the account flows")
        }
        continueAfterFailure = false
        let stamp = Int(Date.now.timeIntervalSince1970)
        let email = "m2-\(stamp)@example.com"
        let newEmail = "m2-\(stamp)-new@example.com"
        let app = XCUIApplication()
        app.launch()
        signOutIfNeeded(app)

        // Welcome and sign-up
        XCTAssertTrue(app.buttons["Create account"].waitForExistence(timeout: 10))
        sleep(2)
        save(app, "01-welcome")
        app.buttons["Create account"].tap()
        type(app.textFields["Name"], "Mia Tester")
        type(app.textFields["Email"], email)
        type(app.secureTextFields["Password"], "password123")
        save(app, "02-sign-up")
        app.buttons["Create account"].firstMatch.tap()
        dismissSavePassword(app)
        XCTAssertTrue(app.tabBars.buttons["Home"].waitForExistence(timeout: 15), "Sign-up didn't reach the app")
        sleep(2)
        save(app, "03-home-new-account")

        // Book: save it, watch a little, come back to Resume
        app.buttons["Open The Science of Getting Rich"].firstMatch.tap()
        let add = app.buttons["Add The Science of Getting Rich to My List"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        add.tap()
        XCTAssertTrue(app.buttons["Remove The Science of Getting Rich from My List"].waitForExistence(timeout: 5))
        save(app, "04-book-saved")
        app.buttons["Play Episode 1 of 5"].tap()
        sleep(14)
        save(app, "05-player")
        closePlayer(app)
        let resume = app.buttons["Resume Episode 1 of 5"]
        XCTAssertTrue(resume.waitForExistence(timeout: 10), "The book didn't offer Resume")
        save(app, "06-book-resume")
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Continue watching"].waitForExistence(timeout: 5), "No Continue watching on Home")
        save(app, "07-home-continue")
        app.swipeUp()
        sleep(1)
        save(app, "07b-home-continue-row")
        app.swipeDown()

        // My List
        app.tabBars.buttons["My List"].tap()
        XCTAssertTrue(app.staticTexts["1 saved series"].waitForExistence(timeout: 5))
        save(app, "08-my-list-saved")
        app.buttons["In progress"].tap()
        sleep(1)
        save(app, "09-my-list-in-progress")
        app.buttons["Finished"].tap()
        sleep(1)
        save(app, "10-my-list-finished-empty")

        // Search
        app.tabBars.buttons["Search"].tap()
        sleep(1)
        save(app, "11-search-browse")
        let field = app.searchFields.firstMatch
        field.tap()
        field.typeText("money")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Episodes that mention'")).firstMatch.waitForExistence(timeout: 10))
        save(app, "12-search-results")
        app.buttons["Episodes"].firstMatch.tap()
        sleep(1)
        save(app, "13-search-episodes")
        app.buttons.matching(NSPredicate(format: "label CONTAINS ' · at '")).firstMatch.tap()
        sleep(8)
        save(app, "14-player-from-search")
        closePlayer(app)

        // Profile, edit name
        app.tabBars.buttons["Profile"].tap()
        XCTAssertTrue(app.staticTexts["Mia Tester"].waitForExistence(timeout: 5))
        sleep(1)
        save(app, "15-profile")
        app.buttons["Edit profile"].tap()
        let name = app.textFields["Name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 12) + "Mia Renamed")
        save(app, "16-edit-profile")
        app.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Mia Renamed"].waitForExistence(timeout: 10), "The new name didn't show")

        // Settings, change password
        app.buttons["Settings"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Change password"].waitForExistence(timeout: 5))
        save(app, "17-settings")
        app.buttons["Change password"].tap()
        type(app.secureTextFields["Current password"], "password123")
        type(app.secureTextFields["New password"], "password456")
        type(app.secureTextFields["Confirm new password"], "password456")
        save(app, "18-change-password")
        app.buttons["Update password"].tap()
        dismissSavePassword(app)
        XCTAssertTrue(app.alerts["Password changed"].waitForExistence(timeout: 10))
        save(app, "19-password-changed")
        app.alerts["Password changed"].buttons["OK"].tap()

        // Change email, confirmed through the emailed link
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Email'")).firstMatch.tap()
        type(app.textFields["New email"], newEmail)
        save(app, "20-change-email")
        app.buttons["Send confirmation link"].tap()
        XCTAssertTrue(app.staticTexts["Check your new inbox"].waitForExistence(timeout: 10))
        save(app, "21-change-email-sent")
        let verifyLink = try link(in: logPath, after: "to=\(newEmail)", containing: "/verify-email")
        openEmailLink(verifyLink, app: app)
        XCTAssertTrue(app.staticTexts["Email updated"].waitForExistence(timeout: 15), "The email link didn't confirm the change")
        save(app, "22-email-updated")
        app.buttons["Done"].firstMatch.tap()
        app.buttons["Done"].firstMatch.tap()

        // Sign out
        app.tabBars.buttons["Profile"].tap()
        app.buttons["Settings"].firstMatch.tap()
        app.swipeUp()
        app.buttons["Sign out"].firstMatch.tap()
        app.sheets.buttons["Sign out"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Create account"].waitForExistence(timeout: 10), "Sign out didn't return to Welcome")
        save(app, "23-signed-out")

        // Forgot password, reset through the emailed link
        app.buttons["Sign in"].firstMatch.tap()
        save(app, "24-sign-in")
        app.buttons["Forgot password?"].tap()
        type(app.textFields["Email"], newEmail)
        save(app, "25-forgot-password")
        app.buttons["Send reset link"].tap()
        XCTAssertTrue(app.staticTexts["Check your email"].waitForExistence(timeout: 10))
        save(app, "26-check-email")
        let resetLink = try link(in: logPath, after: "to=\(newEmail) subject=\"Reset", containing: "/reset-password/")
        openEmailLink(resetLink, app: app)
        let newPassword = app.secureTextFields["New password"]
        XCTAssertTrue(newPassword.waitForExistence(timeout: 15), "The reset link didn't open the app")
        type(newPassword, "password789")
        type(app.secureTextFields["Confirm new password"], "password789")
        save(app, "27-reset-password")
        app.buttons["Save and sign in"].tap()
        dismissSavePassword(app)
        XCTAssertTrue(app.tabBars.buttons["Home"].waitForExistence(timeout: 15), "The reset didn't sign back in")
        sleep(2)
        save(app, "28-signed-in-after-reset")

        // Delete account
        app.tabBars.buttons["Profile"].tap()
        app.buttons["Settings"].firstMatch.tap()
        app.swipeUp()
        app.buttons["Delete account"].tap()
        type(app.secureTextFields["Password"], "password789")
        let understood = app.switches.firstMatch
        understood.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        save(app, "29-delete-account")
        app.swipeUp()
        app.buttons["Delete my account"].tap()
        XCTAssertTrue(app.staticTexts["Your account has been deleted. Thanks for learning with mintsy."].waitForExistence(timeout: 10))
        sleep(1)
        save(app, "30-deleted")

        // Sign in with Apple: what the simulator offers
        app.buttons.matching(NSPredicate(format: "label CONTAINS 'Apple'")).firstMatch.tap()
        sleep(4)
        saveScreen("31-apple-sheet")
    }

    // MARK: Helpers

    /// Opens an emailed link the way the phone would: in Safari, which follows the API's redirect to the app's
    /// scheme and asks to open the app.
    @MainActor
    private func openEmailLink(_ url: URL, app: XCUIApplication) {
        XCUIDevice.shared.system.open(url)
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        let open = safari.buttons["Open"]
        if open.waitForExistence(timeout: 15) {
            saveScreen("open-in-app-prompt-\(url.path().contains("verify") ? "email" : "reset")")
            open.tap()
        }
        _ = app.wait(for: .runningForeground, timeout: 10)
    }

    /// The first link in the backend's log after `marker` that contains `fragment`.
    private func link(in logPath: String, after marker: String, containing fragment: String) throws -> URL {
        for _ in 0..<20 {
            let log = (try? String(contentsOfFile: logPath, encoding: .utf8)) ?? ""
            if let start = log.range(of: marker, options: .backwards) {
                let tail = log[start.upperBound...]
                if let line = tail.split(separator: "\n").first(where: { $0.contains("link: ") && $0.contains(fragment) }),
                   let url = URL(string: String(line.split(separator: "link: ").last ?? "").trimmingCharacters(in: .whitespaces)) {
                    return url
                }
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        throw XCTSkip("No \(fragment) link for \(marker) in \(logPath)")
    }

    @MainActor
    private func signOutIfNeeded(_ app: XCUIApplication) {
        guard app.tabBars.buttons["Profile"].waitForExistence(timeout: 4) else { return }
        app.tabBars.buttons["Profile"].tap()
        app.buttons["Settings"].firstMatch.tap()
        app.swipeUp()
        app.buttons["Sign out"].firstMatch.tap()
        app.sheets.buttons["Sign out"].firstMatch.tap()
    }

    @MainActor
    private func closePlayer(_ app: XCUIApplication) {
        let close = app.buttons["Close player"]
        if !close.isHittable {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
        }
        XCTAssertTrue(close.waitForExistence(timeout: 3))
        close.tap()
        sleep(2)
    }

    @MainActor
    private func type(_ element: XCUIElement, _ text: String) {
        XCTAssertTrue(element.waitForExistence(timeout: 5), "\(element) isn't there")
        element.tap()
        // New-password fields get the system's "Use Strong Password?" panel instead of a keyboard: choose our own
        let app = XCUIApplication()
        if app.buttons["GenerateStrongPasswordButton"].waitForExistence(timeout: 1.5) {
            app.buttons["Close"].firstMatch.tap()
            element.tap()
        }
        element.typeText(text)
    }

    /// The system's "Save Password?" sheet after a sign-in.
    @MainActor
    private func dismissSavePassword(_ app: XCUIApplication) {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for candidate in [app.buttons["Not Now"], springboard.buttons["Not Now"]] where candidate.waitForExistence(timeout: 3) {
            candidate.tap()
            return
        }
    }

    @MainActor
    private func save(_ app: XCUIApplication, _ name: String) {
        record(app.screenshot(), name)
    }

    /// The whole screen, for system sheets over the app.
    @MainActor
    private func saveScreen(_ name: String) {
        record(XCUIScreen.main.screenshot(), name)
    }

    @MainActor
    private func record(_ shot: XCUIScreenshot, _ name: String) {
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let screenshotFolder {
            try? shot.pngRepresentation.write(to: screenshotFolder.appending(path: "\(name).png"))
        }
    }
}
