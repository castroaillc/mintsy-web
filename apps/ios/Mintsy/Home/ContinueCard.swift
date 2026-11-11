import SwiftUI

/// A Continue watching card (Expo `continue-card.tsx`): the episode on its book's tint with a progress bar along the
/// bottom, then the book and how much is left.
struct ContinueCard: View {
    let item: ContinueItem
    let onPlay: () -> Void

    var body: some View {
        let position = item.entry?.positionSec ?? 0
        let label = "\(SeriesFormat.episodeLabel(item.episode, in: item.book)) · \(ProgressLogic.minutesLeft(item.episode, positionSec: position)) min left"
        Button(action: onPlay) {
            VStack(alignment: .leading, spacing: 10) {
                ZStack(alignment: .topLeading) {
                    Color(hex: item.book.tint) ?? Palette.card
                    Text("CH. \(item.episode.number)")
                        .font(BrandFont.display(13, relativeTo: .footnote))
                        .kerning(1)
                        .foregroundStyle(Palette.onTint)
                        .padding(.leading, 14)
                        .padding(.top, 12)
                    Text(item.episode.title)
                        .font(BrandFont.display(17, relativeTo: .headline))
                        .foregroundStyle(Palette.onTint)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .padding(.leading, 14)
                        .padding(.trailing, 60)
                        .padding(.bottom, 18)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    Image(systemName: item.episode.locked ? "lock.fill" : "play.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Palette.onScrim)
                        .frame(width: 38, height: 38)
                        .background(Palette.scrim.opacity(0.7), in: .circle)
                        .padding(.trailing, 12)
                        .padding(.bottom, 14)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    ProgressBar(value: ProgressLogic.fraction(item.episode, item.entry), track: Palette.onScrim.opacity(0.2))
                        .clipShape(.rect)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                }
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
                .frame(width: 236, height: 133)
                .clipShape(.rect(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.book.title)
                        .font(BrandFont.inter(15, .semibold, relativeTo: .headline))
                        .foregroundStyle(Palette.foreground)
                    Text(label)
                        .font(BrandFont.inter(13, relativeTo: .footnote))
                        .foregroundStyle(Palette.mutedForeground)
                }
                .lineLimit(1)
            }
            .frame(width: 236, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.episode.locked ? "Unlock with Premium" : "Resume") \(item.book.title), \(item.episode.title). \(label)")
        .accessibilityAddTraits(.isButton)
    }
}
