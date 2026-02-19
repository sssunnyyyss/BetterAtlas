export type FeedbackHubPostStatus =
  | "open"
  | "under_review"
  | "planned"
  | "in_progress"
  | "complete";

export type FeedbackHubAuthorMode = "pseudonymous" | "linked_profile";

export type FeedbackHubSort = "trending" | "top" | "new";

export interface FeedbackHubBoard {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  postCount: number;
}

export interface FeedbackHubCategory {
  id: number;
  boardId: number;
  slug: string;
  name: string;
  postCount: number;
}

export interface FeedbackHubAuthor {
  userId: string | null;
  username: string | null;
  displayName: string;
  mode: FeedbackHubAuthorMode;
}

export interface FeedbackHubPostSummary {
  id: number;
  board: Pick<FeedbackHubBoard, "id" | "slug" | "name">;
  category: Pick<FeedbackHubCategory, "id" | "slug" | "name"> | null;
  title: string;
  details: string | null;
  status: FeedbackHubPostStatus;
  score: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  author: FeedbackHubAuthor;
  viewerHasVoted: boolean;
}

export interface FeedbackHubComment {
  id: number;
  postId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: FeedbackHubAuthor;
}

export interface FeedbackHubStatusHistoryItem {
  id: number;
  fromStatus: FeedbackHubPostStatus | null;
  toStatus: FeedbackHubPostStatus;
  note: string | null;
  createdAt: string;
  changedBy: FeedbackHubAuthor | null;
}

export interface FeedbackHubPostDetail extends FeedbackHubPostSummary {
  comments: FeedbackHubComment[];
  statusHistory: FeedbackHubStatusHistoryItem[];
}

export interface FeedbackHubRoadmapColumn {
  status: Extract<FeedbackHubPostStatus, "planned" | "in_progress" | "complete">;
  label: string;
  posts: FeedbackHubPostSummary[];
}

export interface FeedbackHubChangelogEntry {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
  publishedBy: FeedbackHubAuthor | null;
  linkedPosts: Array<Pick<FeedbackHubPostSummary, "id" | "title" | "status" | "board">>;
}

export interface FeedbackHubPaginatedPosts {
  items: FeedbackHubPostSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FeedbackHubBoardCategoriesResponse {
  board: Pick<FeedbackHubBoard, "id" | "slug" | "name" | "description" | "isPublic">;
  categories: FeedbackHubCategory[];
}

export interface FeedbackHubBoardPostsResponse extends FeedbackHubPaginatedPosts {
  board: Pick<FeedbackHubBoard, "id" | "slug" | "name" | "description" | "isPublic">;
}

export interface FeedbackHubPaginatedChangelog {
  items: FeedbackHubChangelogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
