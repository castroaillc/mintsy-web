import SwiftUI

/// Welcome, with sign-in, sign-up and forgot password pushed over it. Sign-in and sign-up swap with each other
/// rather than stacking, as in the Expo app.
struct SignedOutFlow: View {
    @State private var path: [AuthRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            WelcomeView(onCreateAccount: { show(.signUp) }, onSignIn: { show(.signIn) })
                .navigationDestination(for: AuthRoute.self) { route in
                    switch route {
                    case .signIn:
                        SignInView(onCreateAccount: { swap(to: .signUp) }, onForgotPassword: { path.append(.forgotPassword) })
                    case .signUp:
                        SignUpView(onSignIn: { swap(to: .signIn) })
                    case .forgotPassword:
                        ForgotPasswordView(onBackToSignIn: backToSignIn)
                    }
                }
        }
    }

    private func show(_ route: AuthRoute) {
        path = [route]
    }

    /// Replaces the form on top (sign-in ↔ sign-up).
    private func swap(to route: AuthRoute) {
        if path.isEmpty {
            path = [route]
        } else {
            path[path.count - 1] = route
        }
    }

    private func backToSignIn() {
        path = [.signIn]
    }
}
