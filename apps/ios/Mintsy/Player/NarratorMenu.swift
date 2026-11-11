import SwiftUI

/// The narrator picker: only shown when an episode has more than one playable voice. Switching keeps the place in
/// the episode and becomes the default for other episodes.
struct NarratorMenu: View {
    let model: PlayerModel

    var body: some View {
        let selected = model.selectedVoice
        Menu {
            Section("Narrator") {
                ForEach(model.voiceOptions) { voice in
                    Button {
                        pick(voice)
                    } label: {
                        if voice.id == selected?.id {
                            Label(voice.name, systemImage: "checkmark")
                        } else {
                            Text(voice.name)
                        }
                    }
                }
            }
        } label: {
            Label(selected?.name ?? "Narrator", systemImage: "person.wave.2")
        }
        .buttonStyle(.controlChip)
        .accessibilityLabel("Narrator: \(selected?.name ?? "default"). Change narrator")
    }

    private func pick(_ voice: EpisodeVoice) {
        Task { await model.pickVoice(voice.id) }
    }
}
