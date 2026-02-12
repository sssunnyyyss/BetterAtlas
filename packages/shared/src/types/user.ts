export interface User {
  id: number;
  email: string;
  displayName: string;
  graduationYear: number | null;
  major: string | null;
  createdAt: string;
}

export interface UserProfile extends User {
  reviewCount: number;
}
