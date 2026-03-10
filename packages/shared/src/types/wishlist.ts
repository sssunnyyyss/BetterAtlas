import type { ScheduleCourseBlock } from "./schedule.js";

export interface WishlistItem extends ScheduleCourseBlock {
    /** Number of mutual friends who also have this course on their wishlist. */
    friendOverlapCount: number;
}

export interface MyWishlistResponse {
    term: { code: string; name: string | null };
    listId: number | null;
    items: WishlistItem[];
}
