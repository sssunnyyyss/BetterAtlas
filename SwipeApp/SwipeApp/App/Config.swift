import Foundation

enum Config {
    /// Base URL of the Express API (no trailing slash)
    static let apiBaseURL = "http://localhost:3001/api/swipe"

    /// Stripe publishable key — set in Info.plist as STRIPE_PUBLISHABLE_KEY
    static let stripePublishableKey: String = {
        Bundle.main.infoDictionary?["STRIPE_PUBLISHABLE_KEY"] as? String ?? ""
    }()

    /// Apple Pay merchant identifier configured in Apple Developer portal
    static let merchantId = "merchant.com.betteratlas.swipe"

    /// Supabase project URL
    static let supabaseURL = "https://atlas.sunworkstudios.com"

    /// Supabase anon key
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
}
