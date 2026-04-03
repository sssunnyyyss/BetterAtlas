import Foundation

struct SwipeLocation: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let address: String?
    let isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, address
        case isActive = "is_active"
    }
}
