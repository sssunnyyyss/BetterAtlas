import SwiftUI
import StripePaymentsUI

@main
struct SwipeAppApp: App {
    @StateObject private var authViewModel = AuthViewModel()

    init() {
        StripeAPI.defaultPublishableKey = Config.stripePublishableKey
    }

    var body: some Scene {
        WindowGroup {
            if authViewModel.isLoading {
                ProgressView()
            } else if authViewModel.session != nil {
                HomeView()
                    .environmentObject(authViewModel)
            } else {
                LoginView()
                    .environmentObject(authViewModel)
            }
        }
    }
}
