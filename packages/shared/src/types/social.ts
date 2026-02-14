export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface Friendship {
  id: number;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendWithProfile {
  friendshipId: number;
  user: {
    id: string; // UUID
    username: string;
    fullName: string;
    graduationYear: number | null;
    major: string | null;
  };
  status: FriendshipStatus;
}

export interface CourseList {
  id: number;
  userId: number;
  semester: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
}

export interface CourseListItem {
  id: number;
  listId: number;
  sectionId: number;
  color: string | null;
  addedAt: string;
}

export interface CourseListWithItems extends CourseList {
  items: (CourseListItem & {
    course: { code: string; title: string };
    section: { sectionNumber: string | null; semester: string };
  })[];
}
