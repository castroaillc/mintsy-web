import SwiftUI

/// My List, Finished and Settings, as one card of rows (design 11).
struct ProfileLinksCard: View {
    let savedCount: Int
    let finishedCount: Int
    let onOpenMyList: (MyListSegment) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: openSaved) {
                LinkRowLabel(title: "My List", value: "\(savedCount) saved")
            }
            Divider().overlay(Palette.border)
            Button(action: openFinished) {
                LinkRowLabel(title: "Finished", value: "^[\(finishedCount) series](inflect: true)")
            }
            Divider().overlay(Palette.border)
            NavigationLink(value: ProfileRoute.settings) {
                LinkRowLabel(title: "Settings", value: nil)
            }
        }
        .buttonStyle(.plain)
        .background(Palette.card, in: .rect(cornerRadius: 16))
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.border) }
    }

    private func openSaved() {
        onOpenMyList(.saved)
    }

    private func openFinished() {
        onOpenMyList(.finished)
    }
}
