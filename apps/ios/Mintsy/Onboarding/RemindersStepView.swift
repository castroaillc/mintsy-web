import SwiftUI

/// Step 3 (design 9): a daily reminder. "Turn on reminders" shows the system's permission prompt and, when it's
/// allowed, schedules one local notification a day on this device. Nothing is registered with the API.
struct RemindersStepView: View {
    let onNext: () -> Void

    @Environment(OnboardingStore.self) private var onboarding
    @Environment(CatalogStore.self) private var catalog
    @State private var time = ReminderTime.morning
    @State private var isBusy = false
    @State private var wasRefused = false

    var body: some View {
        OnboardingShell(
            step: .reminders,
            title: "Want a daily nudge?",
            subtitle: "One reminder a day to pick up your next episode. Change it anytime in Settings.",
            showsFooterDivider: false,
            onSkip: skip
        ) {
            NotificationPreview(books: catalog.books)
                .padding(.top, 20)
        } content: {
            HStack(spacing: 10) {
                ForEach(ReminderTime.allCases) { option in
                    ReminderTimeTile(time: option, selection: $time)
                }
            }
            .padding(.top, 22)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Reminder time")
        } footer: {
            SubmitButton(title: "Turn on reminders", isBusy: isBusy, action: turnOn)
                .disabled(isBusy)
            SecondaryActionButton(title: "Not now", action: decline)
                .disabled(isBusy)
        }
        .task { time = onboarding.answers.reminderTime }
        .alert("Notifications are off", isPresented: $wasRefused) {
            Button("OK", action: onNext)
        } message: {
            Text("You can turn on reminders later in Settings.")
        }
    }

    private func skip() {
        onboarding.markStep(.reminders)
        onNext()
    }

    private func decline() {
        let time = time
        onboarding.markStep(.reminders) { answers in
            answers.reminderTime = time
            answers.remindersOn = false
        }
        onNext()
    }

    private func turnOn() {
        isBusy = true
        Task {
            let isOn = await onboarding.turnOnReminders(at: time)
            onboarding.markStep(.reminders)
            isBusy = false
            if isOn {
                onNext()
            } else {
                wasRefused = true
            }
        }
    }
}
