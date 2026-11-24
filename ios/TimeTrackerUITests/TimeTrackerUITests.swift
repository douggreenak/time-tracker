import XCTest

/// End-to-end tests. They drive the real app in the simulator against a local copy of the web backend
/// (`ENABLE_DEMO_DATA=true npx next dev -p 3100`), where every sample person's password is `demo1234`.
final class TimeTrackerUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    // MARK: Helpers

    private func launch(as user: String? = nil, tab: Int = 0, reset: Bool = false) {
        var args = ["-serverURL", "http://localhost:3100", "-debugTab", "\(tab)"]
        if reset { args += ["-resetSession", "YES"] }
        if let user { args += ["-debugUser", user, "-debugPassword", "demo1234"] }
        app.launchArguments = args
        app.launch()
    }

    private func tab(_ name: String) -> XCUIElement { app.tabBars.buttons[name] }

    private func waitFor(_ e: XCUIElement, _ t: TimeInterval = 15, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(e.waitForExistence(timeout: t), "Expected \(e) to appear", file: file, line: line)
    }

    private func button(beginningWith prefix: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    private func screenshot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways
        add(a)
    }

    private var stamp: String { String(Int(Date().timeIntervalSince1970) % 1_000_000) }

    // MARK: Sign-in

    func testSignInAsEngineerHidesReviewThenSignOut() {
        launch(reset: true)
        let picker = app.buttons["Choose your name"]
        waitFor(picker)
        screenshot("login")
        picker.tap()
        app.buttons["Priya Nair — Engineer"].tap()
        let pw = app.secureTextFields["Password"]
        pw.tap(); pw.typeText("demo1234")
        app.buttons["Sign in"].tap()

        waitFor(app.navigationBars["Timer"])
        XCTAssertFalse(tab("Review").exists, "Engineers must not see the Review tab")
        XCTAssertTrue(tab("Timesheet").exists && tab("Data").exists && tab("Account").exists)

        tab("Account").tap()
        waitFor(app.staticTexts["Priya Nair"])
        XCTAssertFalse(app.staticTexts["Team"].exists, "Engineers must not see the team list")
        screenshot("account-engineer")
        app.buttons["Sign out"].tap()
        app.buttons.matching(identifier: "Sign out").element(boundBy: 1).tap()
        waitFor(app.staticTexts["Time Tracker"])
        waitFor(app.buttons["Choose your name"])
    }

    func testWrongPasswordShowsError() {
        launch(reset: true)
        waitFor(app.buttons["Choose your name"])
        app.buttons["Choose your name"].tap()
        app.buttons["Callum Brooks — Engineer"].tap()
        let pw = app.secureTextFields["Password"]
        pw.tap(); pw.typeText("not-the-password")
        app.buttons["Sign in"].tap()
        waitFor(app.staticTexts["Wrong password."])
        XCTAssertFalse(app.navigationBars["Timer"].exists)
    }

    // MARK: Timer

    func testTimerStartPauseResumeStop() {
        launch(as: "Callum Brooks")
        waitFor(app.navigationBars["Timer"])
        // Clean up any timer left over from an earlier run.
        if app.buttons["Stop"].waitForExistence(timeout: 3) { app.buttons["Stop"].tap(); sleep(2) }

        let start = app.buttons["Start"]
        waitFor(start)
        start.tap()
        waitFor(app.staticTexts["Running"])
        screenshot("timer-running")
        sleep(3)
        app.buttons["Pause"].tap()
        waitFor(app.staticTexts["Paused"])
        XCTAssertNotEqual(app.staticTexts["00:00:00"].exists, true, "Clock should have advanced while running")
        app.buttons["Resume"].tap()
        waitFor(app.staticTexts["Running"])

        // The mini timer follows you to other tabs.
        tab("Timesheet").tap()
        waitFor(app.navigationBars["Timesheet"])
        tab("Timer").tap()

        app.buttons["Stop"].tap()
        waitFor(app.staticTexts["Saved to your timesheet as a draft"])
        waitFor(app.buttons["Start"])
        screenshot("timer-stopped")
    }

    func testTimerSurvivesRelaunch() {
        launch(as: "Tomas Herrera")
        waitFor(app.navigationBars["Timer"])
        if app.buttons["Stop"].waitForExistence(timeout: 3) { app.buttons["Stop"].tap(); sleep(2) }
        app.buttons["Start"].tap()
        waitFor(app.staticTexts["Running"])
        app.terminate()
        launch(as: "Tomas Herrera")
        waitFor(app.staticTexts["Running"])   // came back from the cloud
        app.buttons["Stop"].tap()
        waitFor(app.buttons["Start"])
    }

    // MARK: Timesheet

    func testAddSubmitEditDeleteEntry() {
        launch(as: "Callum Brooks", tab: 1)
        waitFor(app.navigationBars["Timesheet"])
        let note = "UITest \(stamp)"

        // Add
        app.buttons["Add time"].tap()
        waitFor(app.navigationBars["New entry"])
        let notes = app.textFields["What did you work on?"]
        notes.tap(); notes.typeText(note)
        screenshot("entry-editor")
        app.buttons["Save"].tap()
        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", note)).firstMatch
        waitFor(row)

        // Submit the week
        let submit = button(beginningWith: "Submit ")
        waitFor(submit)
        submit.tap()
        waitFor(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Submitted'")).firstMatch)
        screenshot("timesheet-submitted")

        // Edit
        row.tap()
        waitFor(app.navigationBars["Edit entry"])
        let edited = note + " edited"
        let field = app.textFields.matching(NSPredicate(format: "value CONTAINS %@", note)).firstMatch
        field.tap(); field.typeText(" edited")
        app.buttons["Save"].tap()
        let editedRow = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", edited)).firstMatch
        waitFor(editedRow)

        // Delete
        editedRow.tap()
        waitFor(app.navigationBars["Edit entry"])
        let del = app.buttons["Delete entry"]
        for _ in 0..<4 where !del.isHittable { app.swipeUp() }
        del.tap()
        app.buttons["Delete"].tap()
        XCTAssertTrue(editedRow.waitForNonExistence(timeout: 10), "Deleted entry should disappear")
    }

    // MARK: Review

    func testManagerSeesReviewAndCanApproveAndAsk() throws {
        launch(as: "Marguerite Okafor", tab: 2)
        waitFor(app.navigationBars["Review"])
        XCTAssertTrue(tab("Review").exists)
        screenshot("review")

        // Open the first entry and ask a question.
        let first = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Submitted'")).firstMatch
        if !first.waitForExistence(timeout: 5) { throw XCTSkip("Nothing is waiting for review in this database") }
        first.tap()
        waitFor(app.navigationBars["Entry"])
        let q = app.textFields["e.g. Which site was this for?"]
        for _ in 0..<4 where !q.isHittable { app.swipeUp() }
        q.tap(); q.typeText("Which site was this?")
        app.buttons["Send question"].tap()
        waitFor(app.staticTexts["Open question"])
        screenshot("review-question")
        app.swipeDown()  // scroll up
        app.buttons["Withdraw question"].tap()
        XCTAssertTrue(app.staticTexts["Open question"].waitForNonExistence(timeout: 10))
        app.buttons["Done"].tap()

        // Approve a person's submitted time in one tap.
        let approve = button(beginningWith: "Approve ")
        if approve.waitForExistence(timeout: 5) {
            approve.tap()
            waitFor(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Approved'")).firstMatch)
        }
    }

    // MARK: Data

    func testAddCustomerAndTask() throws {
        launch(as: "Ingrid Solberg", tab: 3)
        waitFor(app.navigationBars["Data"])
        let name = "UITest Co \(stamp)"
        app.buttons["Add"].tap()
        let field = app.alerts.textFields["Name"]
        waitFor(field)
        field.typeText(name)
        app.alerts.buttons["Add"].tap()
        waitFor(app.staticTexts[name])
        screenshot("data-customer")

        app.buttons["Tasks"].tap()
        let task = "UITest Task \(stamp)"
        app.buttons["Add"].tap()
        waitFor(app.alerts.textFields["Name"])
        app.alerts.textFields["Name"].typeText(task)
        app.alerts.buttons["Add"].tap()
        waitFor(app.staticTexts[task])
    }

    // MARK: Account

    func testChangePasswordRejectsMismatch() {
        launch(as: "Callum Brooks", tab: 4)
        waitFor(app.navigationBars["Account"])
        app.buttons["Change password"].tap()
        waitFor(app.navigationBars["Change password"])
        let cur = app.secureTextFields["Current password"]; cur.tap(); cur.typeText("demo1234")
        let new = app.secureTextFields["New password"]; new.tap(); new.typeText("abcd1")
        let rep = app.secureTextFields["Repeat new password"]; rep.tap(); rep.typeText("different")
        app.buttons["Save"].tap()
        waitFor(app.staticTexts["The new passwords don't match."])
    }

    func testAdminSeesTeamAndAllTabs() {
        launch(as: "Ingrid Solberg", tab: 4)
        waitFor(app.navigationBars["Account"])
        for t in ["Timer", "Timesheet", "Review", "Data", "Account"] { XCTAssertTrue(tab(t).exists, "\(t) tab missing") }
        waitFor(app.staticTexts["Team"])
        screenshot("account-admin")
    }
}
