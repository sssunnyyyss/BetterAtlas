export interface User {
  id: string; // UUID from Supabase Auth
  email: string;
  username: string; // stored without leading "@"
  fullName: string;
  graduationYear: number | null;
  major: string | null;
  createdAt: string;
}

export interface UserProfile extends User {
  reviewCount: number;
}
