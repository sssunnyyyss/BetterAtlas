import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { Instructor, ProfessorDetail } from "@betteratlas/shared";

export function useInstructors(params?: { q?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  qs.set("limit", String(params?.limit ?? 500));

  const queryString = qs.toString();

  return useQuery({
    queryKey: ["instructors", params?.q ?? "", params?.limit ?? 500],
    queryFn: () => api.get<Instructor[]>(`/instructors?${queryString}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfessorDetail(id: number) {
  return useQuery({
    queryKey: ["professor", id],
    queryFn: () => api.get<ProfessorDetail>(`/instructors/${id}`),
    enabled: id > 0,
  });
}
