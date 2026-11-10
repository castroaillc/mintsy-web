import SwiftUI

/// Everything under the video panel, scrolling, with the transcript following playback until the viewer scrolls.
struct PlayerDetails: View {
    let model: PlayerModel
    let onSelectEpisode: (Episode) -> Void

    @State private var tab: PlayerTab = .transcript
    @State private var isFollowing = true

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PlayerInfoSection(book: model.book, episode: model.episode)
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.top, 18)
                    PlayerControlRow(model: model, onSelectEpisode: onSelectEpisode)
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.top, 16)
                    UnderlineTabs(tabs: PlayerTab.allCases, selection: $tab, uniformWeight: true)
                        .padding(.top, 22)

                    switch tab {
                    case .transcript:
                        TranscriptListView(model: model, isFollowing: isFollowing, onSeek: seekToLine)
                    case .takeaways:
                        TakeawaysView(takeaways: model.episode.takeaways)
                            .padding(.horizontal, Metrics.gutter)
                            .padding(.top, 16)
                    }

                    if let next = model.nextEpisode {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHeader(title: "Up next")
                            UpNextCard(book: model.book, episode: next) { onSelectEpisode(next) }
                        }
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.top, 26)
                    }
                }
                .padding(.bottom, 32)
            }
            .onScrollPhaseChange { _, phase in
                if phase == .interacting { isFollowing = false }
            }
            .onChange(of: model.activeLineIndex) { _, index in
                guard isFollowing, tab == .transcript else { return }
                withAnimation { proxy.scrollTo(index, anchor: UnitPoint(x: 0.5, y: 0.33)) }
            }
            .onChange(of: isFollowing) { _, following in
                guard following, tab == .transcript else { return }
                withAnimation { proxy.scrollTo(model.activeLineIndex, anchor: UnitPoint(x: 0.5, y: 0.33)) }
            }
            .overlay(alignment: .bottom) {
                if !isFollowing && tab == .transcript {
                    Button("Back to current", systemImage: "arrow.down", action: followAgain)
                        .font(BrandFont.inter(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(Palette.background)
                        .padding(.horizontal, 16)
                        .frame(minHeight: Metrics.minTap)
                        .background(Palette.foreground, in: .capsule)
                        .padding(.bottom, 16)
                }
            }
        }
    }

    private func seekToLine(_ sec: Double) {
        model.seek(to: sec)
        model.showControls()
        isFollowing = true
    }

    private func followAgain() {
        isFollowing = true
    }
}
