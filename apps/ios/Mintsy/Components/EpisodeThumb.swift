import SwiftUI

/// Tinted chapter thumbnail with number, play (or lock) badge and duration.
struct EpisodeThumb: View {
    enum Size { case medium, small }

    let episode: Episode
    var size: Size = .medium
    var locked = false
    /// 0–1 watched, drawn along the bottom; nil for none.
    var progress: Double?

    var body: some View {
        let medium = size == .medium
        ZStack {
            Palette.episodeTints[(episode.number - 1) % Palette.episodeTints.count]

            if let url = episode.thumbnailUrl {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
            }

            Text(episode.number, format: .number)
                .font(BrandFont.display(medium ? 22 : 18, relativeTo: .title3))
                .foregroundStyle(Palette.onTint)
                .padding(.leading, medium ? 10 : 8)
                .padding(.top, medium ? 8 : 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if medium || locked {
                Image(systemName: locked ? "lock.fill" : "play.fill")
                    .font(.system(size: locked ? 14 : 12))
                    .foregroundStyle(Palette.onScrim)
                    .frame(width: medium ? 32 : 30, height: medium ? 32 : 30)
                    .background(Palette.scrim.opacity(0.7), in: .circle)
            }

            Text(SeriesFormat.time(Double(episode.durationSec)))
                .font(BrandFont.inter(11, .semibold, relativeTo: .caption2))
                .monospacedDigit()
                .foregroundStyle(Palette.onScrim)
                .padding(.horizontal, 5)
                .frame(height: 18)
                .background(Palette.scrim.opacity(0.8), in: .rect(cornerRadius: 4))
                .padding(.trailing, 6)
                .padding(.bottom, medium ? 9 : 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        }
        .overlay(alignment: .bottom) {
            if let progress {
                ProgressBar(value: progress, height: 3, track: Palette.onScrim.opacity(0.25))
                    .clipShape(.rect)
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .frame(width: medium ? 132 : 112, height: medium ? 76 : 64)
        .clipShape(.rect(cornerRadius: medium ? 10 : 8))
        .accessibilityHidden(true)
    }
}
