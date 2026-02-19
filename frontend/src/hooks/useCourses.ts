import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { CourseWithRatings, CourseDetail, Department } from "@betteratlas/shared";

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useCourses(params: Record<string, string>, enabled = true) {
  const queryString = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["courses", params],
    queryFn: () =>
      api.get<PaginatedResponse<CourseWithRatings>>(
        `/courses?${queryString}`
      ),
    enabled,
  });
}

export function useCourseSearch(params: Record<string, string>, enabled = true) {
  const queryString = new URLSearchParams(params).toString();
  const q = params.q?.trim() ?? "";
  return useQuery({
    queryKey: ["courses", "search", params],
    queryFn: () =>
      api.get<PaginatedResponse<CourseWithRatings>>(
        `/courses/search?${queryString}`
      ),
    enabled: enabled && q.length > 0,
  });
}

export function useCourseDetail(id: number) {
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => api.get<CourseDetail>(`/courses/${id}`),
    enabled: id > 0,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
    staleTime: Infinity,
  });
}
