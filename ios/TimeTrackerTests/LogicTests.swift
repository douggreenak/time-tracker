import XCTest
@testable import TimeTracker

final class FormattingTests: XCTestCase {
    func testWeekStartIsSunday() {
        XCTAssertEqual(Fmt.weekStart("2026-11-22"), "2026-11-22") // Sunday stays
        XCTAssertEqual(Fmt.weekStart("2026-11-25"), "2026-11-22") // Wednesday
        XCTAssertEqual(Fmt.weekStart("2026-11-28"), "2026-11-22") // Saturday
        XCTAssertEqual(Fmt.weekStart("2026-11-29"), "2026-11-29") // next Sunday
        XCTAssertEqual(Fmt.weekStart("2027-01-01"), "2026-12-27") // across a year boundary
    }

    func testDurationText() {
        XCTAssertEqual(Fmt.duration(0), "0m")
        XCTAssertEqual(Fmt.duration(45), "45m")
        XCTAssertEqual(Fmt.duration(60), "1h")
        XCTAssertEqual(Fmt.duration(90), "1h 30m")
        XCTAssertEqual(Fmt.duration(24 * 60), "24h")
    }

    func testDecimalHours() {
        XCTAssertEqual(Fmt.hours(90), "1.5")
        XCTAssertEqual(Fmt.hours(45), "0.75")
        XCTAssertEqual(Fmt.hours(60), "1")
    }

    func testClock() {
        XCTAssertEqual(Fmt.clock(0), "00:00:00")
        XCTAssertEqual(Fmt.clock(3725), "01:02:05")
        XCTAssertEqual(Fmt.clock(-5), "00:00:00")
    }

    func testDateRoundTrip() {
        XCTAssertEqual(Fmt.string(Fmt.date("2026-03-09")), "2026-03-09")
    }
}

final class DecodingTests: XCTestCase {
    private func decode<T: Decodable>(_ json: String, as: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    func testEntryWithNoCustomer() throws {
        let e: TimeEntry = try decode("""
        {"id":"a","userId":"u","userName":"Pat","customerId":"","customerName":"","date":"2026-11-23","durationMinutes":90,
         "notes":"x","isLumpSum":false,"partsNote":"","internalNote":"","contractPo":"","isBillable":true,
         "isInvoiced":false,"invoicedOn":null,"isHeld":false,"createdAt":"2026-11-24T04:10:56.781Z"}
        """)
        XCTAssertEqual(e.title, "No customer")
        XCTAssertNil(e.customerId)
        XCTAssertEqual(e.subtitle, "x")
        XCTAssertEqual(e.statusValue, .open)
        XCTAssertFalse(e.isLocked)
    }

    func testInvoicedAndHeldStates() throws {
        let inv: TimeEntry = try decode(#"{"id":"a","userId":"u","customerId":"c","customerName":"Acme","date":"2026-11-23","durationMinutes":60,"isBillable":true,"isInvoiced":true,"invoicedOn":"2026-11-24","isHeld":false,"partsNote":"Relay $40"}"#)
        XCTAssertEqual(inv.title, "Acme")
        XCTAssertEqual(inv.statusValue, .invoiced)
        XCTAssertTrue(inv.isLocked)
        XCTAssertTrue(inv.hasParts)
        let held: TimeEntry = try decode(#"{"id":"b","userId":"u","date":"2026-11-23","durationMinutes":0,"isLumpSum":true,"isHeld":true}"#)
        XCTAssertEqual(held.statusValue, .held)
        XCTAssertEqual(held.subtitle, "Lump sum")
    }

    func testUserRateAsNumberOrString() throws {
        let a: AppUser = try decode(#"{"id":"1","name":"A","email":"a@x.com","role":"admin","defaultHourlyRate":125}"#)
        let b: AppUser = try decode(#"{"id":"2","name":"B","email":"b@x.com","role":"engineer","defaultHourlyRate":"95.50"}"#)
        let c: AppUser = try decode(#"{"id":"3","name":"C","role":"accountant","defaultHourlyRate":0}"#)
        XCTAssertEqual(a.defaultHourlyRate, 125)
        XCTAssertEqual(b.defaultHourlyRate, 95.5)
        XCTAssertTrue(a.isManager && a.isAdmin)
        XCTAssertFalse(b.isManager)
        XCTAssertTrue(c.isManager && !c.isAdmin)
        XCTAssertEqual(c.email, "")
    }

    func testEnvelopeWithNullData() throws {
        let t: Envelope<Customer> = try decode(#"{"success":true,"data":null}"#)
        XCTAssertTrue(t.success)
        XCTAssertNil(t.data)
        let e: Envelope<Customer> = try decode(#"{"success":false,"error":"Please sign in."}"#)
        XCTAssertEqual(e.error, "Please sign in.")
    }

    func testCustomerFromServer() throws {
        let c: Customer = try decode(#"{"id":"c","name":"Acme","isActive":true,"lastInvoiceDate":"2026-10-31"}"#)
        XCTAssertEqual(c.name, "Acme")
        XCTAssertEqual(c.lastInvoiceDate, "2026-10-31")
        let d: Customer = try decode(#"{"id":"d","name":"Beta","isActive":false,"lastInvoiceDate":null}"#)
        XCTAssertFalse(d.isActive)
    }
}

@MainActor
final class TimerMathTests: XCTestCase {
    private func state(running: Bool, start: Date, before: Int) -> LocalTimer {
        LocalTimer(userId: "u", customerId: "", notes: "", startedAt: start, elapsedBeforePause: before, isRunning: running)
    }

    func testRunningTimerCountsFromStart() {
        let app = AppState()
        let now = Date()
        app.timer = state(running: true, start: now.addingTimeInterval(-65), before: 10)
        XCTAssertEqual(app.elapsedSeconds(at: now), 75)
    }

    func testPausedTimerIsFrozen() {
        let app = AppState()
        app.timer = state(running: false, start: Date(), before: 300)
        XCTAssertEqual(app.elapsedSeconds(at: Date()), 300)
        XCTAssertEqual(app.elapsedSeconds(at: Date().addingTimeInterval(500)), 300)
    }

    func testNoTimer() { XCTAssertEqual(AppState().elapsedSeconds(), 0) }
}

final class DraftTests: XCTestCase {
    func testDraftFromEntryAndMinutes() throws {
        let e: TimeEntry = try JSONDecoder().decode(TimeEntry.self, from: Data("""
        {"id":"a","userId":"u","customerId":"c","date":"2026-11-23","durationMinutes":132,"notes":"n","isBillable":false,"isHeld":true}
        """.utf8))
        let d = EntryDraft(e)
        XCTAssertEqual(d.hours, 2)
        XCTAssertEqual(d.minutes, 12)
        XCTAssertEqual(d.totalMinutes, 132)
        XCTAssertTrue(d.held)
        XCTAssertFalse(d.billable)
        XCTAssertEqual(Fmt.string(d.date), "2026-11-23")
    }

    func testWeekGrouping() throws {
        func entry(_ id: String, _ date: String, _ mins: Int) throws -> TimeEntry {
            try JSONDecoder().decode(TimeEntry.self, from: Data(#"{"id":"\#(id)","userId":"u","date":"\#(date)","durationMinutes":\#(mins),"isBillable":true}"#.utf8))
        }
        let weeks = groupByWeek([try entry("1", "2026-11-22", 60), try entry("2", "2026-11-28", 30), try entry("3", "2026-11-21", 120)])
        XCTAssertEqual(weeks.map(\.start), ["2026-11-22", "2026-11-15"])
        XCTAssertEqual(weeks[0].minutes, 90)
    }
}
