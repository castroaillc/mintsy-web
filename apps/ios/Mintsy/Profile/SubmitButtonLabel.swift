import SwiftUI

/// A list button's title, or a spinner while it works.
struct SubmitButtonLabel: View {
    let title: LocalizedStringResource
    let isBusy: Bool

    var body: some View {
        ZStack {
            Text(title).opacity(isBusy ? 0 : 1)
            ProgressView().opacity(isBusy ? 1 : 0)
        }
        .frame(maxWidth: .infinity)
    }
}
