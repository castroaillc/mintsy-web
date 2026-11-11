import SwiftUI

/// The text input of a password field: hidden, or shown as plain text.
struct PasswordInput: View {
    let placeholder: String
    @Binding var text: String
    let isRevealed: Bool

    var body: some View {
        if isRevealed {
            TextField(placeholder, text: $text)
        } else {
            SecureField(placeholder, text: $text)
        }
    }
}
