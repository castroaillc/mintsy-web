import Foundation
import Observation
import OSLog

/// The signed-in viewer's onboarding answers and daily reminder. The answers are read from this device when the
/// account signs in and saved on every change; nothing here talks to the API. The root view shows onboarding until
/// `answers.onboardingComplete`, once per account on a device, as the Expo app did.
@Observable
final class OnboardingStore {
    /// Defaults until an account's answers are loaded, and after sign-out.
    private(set) var answers = OnboardingAnswers()
    /// The account whose answers are loaded; nil while signed out or still loading.
    private(set) var loadedUserID: String?
    /// The system's notification permission, once it has been read.
    private(set) var permission: ReminderPermission?

    @ObservationIgnored private let storage: any OnboardingStorage
    @ObservationIgnored private let reminders: any ReminderScheduling
    /// "Start Episode 1" on the last step: opened once the tabs are up.
    @ObservationIgnored private var pendingEpisodeID: String?
    @ObservationIgnored private let log = Logger(subsystem: "com.getmintsy.app", category: "onboarding")

    init(storage: any OnboardingStorage, reminders: any ReminderScheduling) {
        self.storage = storage
        self.reminders = reminders
    }

    func isLoaded(for userID: String) -> Bool {
        loadedUserID == userID
    }

    /// The viewer asked for the reminder and the system allows it.
    var remindersActive: Bool {
        answers.remindersOn && permission == .granted
    }

    /// Where the flow resumes.
    var resumeStep: OnboardingStep {
        OnboardingStep.resume(afterStepsDone: answers.stepsDone)
    }

    // MARK: Who's signed in

    /// Signed in: reads the account's answers, and puts its daily reminder back when it had one (sign-out cancels it).
    func load(userID: String) async {
        guard loadedUserID != userID else { return }
        answers = storage.read(userID: userID) ?? OnboardingAnswers()
        pendingEpisodeID = nil
        loadedUserID = userID
        await refreshPermission()
        guard loadedUserID == userID, remindersActive else { return }
        await schedule(answers.reminderTime)
    }

    /// Signed out: the answers stay on the device for the next sign-in, the reminder doesn't keep firing.
    func unload() async {
        guard loadedUserID != nil else { return }
        loadedUserID = nil
        pendingEpisodeID = nil
        answers = OnboardingAnswers()
        await reminders.cancelDaily()
    }

    /// The account was deleted: its answers leave the device too.
    func clear(userID: String) async {
        storage.remove(userID: userID)
        await reminders.cancelDaily()
    }

    // MARK: Answers

    /// Changes the answers and saves them. Does nothing while no account is loaded.
    func update(_ change: (inout OnboardingAnswers) -> Void) {
        guard let loadedUserID else { return }
        var next = answers
        change(&next)
        guard next != answers else { return }
        answers = next
        storage.write(next, userID: loadedUserID)
    }

    /// Records that a step was finished or skipped, with any answers it gave.
    func markStep(_ step: OnboardingStep, _ change: (inout OnboardingAnswers) -> Void = { _ in }) {
        update { answers in
            change(&answers)
            answers.stepsDone = max(answers.stepsDone, step.rawValue)
        }
    }

    /// Finishes onboarding. With an episode, the app opens it once the tabs are up, and Home remembers the series.
    func complete(startEpisodeID: String? = nil, bookID: String? = nil) {
        pendingEpisodeID = startEpisodeID
        update { answers in
            answers.onboardingComplete = true
            answers.stepsDone = OnboardingStep.count
            answers.firstSeriesBookID = bookID
        }
    }

    /// The episode to open after onboarding, handed out once.
    func takePendingEpisode() -> String? {
        defer { pendingEpisodeID = nil }
        return pendingEpisodeID
    }

    // MARK: Daily reminder

    func refreshPermission() async {
        permission = await reminders.permission()
    }

    /// Asks for notification permission if it hasn't been answered, and schedules the reminder when it's allowed.
    /// The time is saved either way. True when the reminder is on.
    @discardableResult
    func turnOnReminders(at time: ReminderTime? = nil) async -> Bool {
        let time = time ?? answers.reminderTime
        var result = await reminders.permission()
        if result == .undetermined {
            result = await reminders.requestPermission()
        }
        permission = result
        let scheduled = result == .granted ? await schedule(time) : false
        update { answers in
            answers.reminderTime = time
            answers.remindersOn = scheduled
        }
        return scheduled
    }

    func turnOffReminders() async {
        update { $0.remindersOn = false }
        await reminders.cancelDaily()
    }

    /// Saves the time, and moves the reminder when it's on.
    func setReminderTime(_ time: ReminderTime) async {
        update { $0.reminderTime = time }
        if remindersActive {
            await schedule(time)
        }
    }

    @discardableResult
    private func schedule(_ time: ReminderTime) async -> Bool {
        do {
            try await reminders.scheduleDaily(at: time)
            return true
        } catch {
            log.error("Couldn't schedule the daily reminder: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }
}
