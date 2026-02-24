import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { MyWishlistResponse } from "@betteratlas/shared";

export function useMyWishlist(term?: string) {
    const qs = term ? `?term=${encodeURIComponent(term)}` : "";
    return useQuery({
        queryKey: ["wishlist", "me", term ?? ""],
        queryFn: () => api.get<MyWishlistResponse>(`/wishlist${qs}`),
    });
}

export function useAddToWishlist() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { sectionId: number; color?: string }) =>
            api.post<MyWishlistResponse>("/wishlist/items", data),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["wishlist", "me"] }),
    });
}

export function useRemoveFromWishlist() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (itemId: number) => api.delete(`/wishlist/items/${itemId}`),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["wishlist", "me"] }),
    });
}

export function useMoveToSchedule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (itemId: number) =>
            api.post<{ moved: boolean; sectionId: number }>(
                `/wishlist/items/${itemId}/move-to-schedule`
            ),
        onSuccess: () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ["wishlist", "me"] }),
                queryClient.invalidateQueries({ queryKey: ["schedule", "me"] }),
                queryClient.invalidateQueries({ queryKey: ["schedule", "friends"] }),
            ]),
    });
}
