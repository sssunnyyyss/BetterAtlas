import Foundation

struct SwipeRequest: Codable, Identifiable {
    let id: String
    let buyerId: String
    let locationId: Int
    let status: String
    let amountCents: Int
    let stripePaymentIntentId: String?
    let expiresAt: String?
    let createdAt: String?
    var match: SwipeMatch?

    enum CodingKeys: String, CodingKey {
        case id, status, match
        case buyerId = "buyer_id"
        case locationId = "location_id"
        case amountCents = "amount_cents"
        case stripePaymentIntentId = "stripe_payment_intent_id"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}

struct PaymentIntentResponse: Codable {
    let clientSecret: String
    let paymentIntentId: String

    enum CodingKeys: String, CodingKey {
        case clientSecret = "clientSecret"
        case paymentIntentId = "paymentIntentId"
    }
}
