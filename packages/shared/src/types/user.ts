export interface Badge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: string;
}

export interface User {
  id: string; // UUID from Supabase Auth
  email: string;
  isAdmin: boolean;
  username: string; // stored without leading "@"
  fullName: string;
  graduationYear: number | null;
  major: string | null;
  hasCompletedOnboarding?: boolean;
  badges?: Badge[];
  createdAt: string;
}

export interface UserProfile extends User {
  reviewCount: number;
}
