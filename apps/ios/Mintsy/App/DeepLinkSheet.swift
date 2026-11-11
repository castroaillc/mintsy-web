import SwiftUI

/// What an email link opens: choosing a new password, or the result of confirming a new email address.
struct DeepLinkSheet: View {
    let link: DeepLink

    var body: some View {
        NavigationStack {
            switch link {
            case .resetPassword(let token, let error):
                ResetPasswordView(token: error == nil ? token : nil)
            case .emailChanged(let error):
                EmailChangedView(errorCode: error)
            }
        }
        .presentationBackground(Palette.background)
    }
}
