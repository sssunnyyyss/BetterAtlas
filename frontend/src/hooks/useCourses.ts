import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { CourseWithRatings, CourseDetail, Department } from "@betteratlas/shared";

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useCourses(params: Record<string, string>) {
  const queryString = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["courses", params],
    queryFn: () =>
      api.get<PaginatedResponse<CourseWithRatings>>(
        `/courses?${queryString}`
      ),
  });
}

export function useCourseSearch(q: string, page = 1) {
  return useQuery({
    queryKey: ["courses", "search", q, page],
    queryFn: () =>
      api.get<PaginatedResponse<CourseWithRatings>>(
        `/courses/search?q=${encodeURIComponent(q)}&page=${page}`
      ),
    enabled: q.length > 0,
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
