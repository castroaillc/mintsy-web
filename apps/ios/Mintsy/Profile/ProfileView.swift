import SwiftUI

/// The Profile tab (design 11): who's signed in, what's in progress, links into My List, and Settings with the
/// account screens. Edit profile opens as a sheet (design 12).
struct ProfileView: View {
    let user: AuthUser
    let onOpenMyList: (MyListSegment) -> Void

    @State private var path: [ProfileRoute] = []
    @State private var isEditing = false

    var body: some View {
        NavigationStack(path: $path) {
            ProfileHome(user: user, onEdit: edit, onOpenMyList: onOpenMyList)
                .navigationDestination(for: ProfileRoute.self) { route in
                    switch route {
                    case .settings:
                        SettingsView(user: user)
                    case .plan:
                        PlanDetailsView(user: user)
                    case .changeEmail:
                        ChangeEmailView(user: user)
                    case .changePassword:
                        ChangePasswordView(user: user)
                    case .deleteAccount:
                        DeleteAccountView(user: user)
                    }
                }
                .navigationDestination(for: BookRoute.self) { route in
                    BookScreen(bookID: route.bookID)
                }
        }
        .sheet(isPresented: $isEditing) {
            NavigationStack {
                EditProfileView(user: user, onChangeEmail: changeEmail)
            }
            .presentationBackground(Palette.background)
        }
    }

    private func edit() {
        isEditing = true
    }

    /// From Edit profile: close the sheet and open Change email in the stack.
    private func changeEmail() {
        isEditing = false
        path.append(.changeEmail)
    }
}
