export interface User {
  id: string; // UUID from Supabase Auth
  email: string;
  displayName: string;
  graduationYear: number | null;
  major: string | null;
  createdAt: string;
}

export interface UserProfile extends User {
  reviewCount: number;
}
