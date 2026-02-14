import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type {
  FriendScheduleResponse,
  MyScheduleResponse,
  ScheduleCourseBlock,
} from "@betteratlas/shared";

export function useMySchedule(term?: string) {
  const qs = term ? `?term=${encodeURIComponent(term)}` : "";
  return useQuery({
    queryKey: ["schedule", "me", term ?? ""],
    queryFn: () => api.get<MyScheduleResponse>(`/schedule${qs}`),
  });
}

export function useFriendsSchedules(term?: string) {
  const qs = term ? `?term=${encodeURIComponent(term)}` : "";
  return useQuery({
    queryKey: ["schedule", "friends", term ?? ""],
    queryFn: () => api.get<FriendScheduleResponse[]>(`/schedule/friends${qs}`),
    enabled: !!term,
  });
}

export function useAddToSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { sectionId: number; color?: string }) =>
      api.post<{ term: MyScheduleResponse["term"]; listId: number | null; item: ScheduleCourseBlock | null }>(
        "/schedule/items",
        data
      ),
    onSuccess: (_data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule", "me"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule", "friends"] }),
      ]),
  });
}

export function useRemoveFromSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.delete(`/schedule/items/${itemId}`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule", "me"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule", "friends"] }),
      ]),
  });
}
