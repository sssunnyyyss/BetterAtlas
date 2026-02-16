import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type {
  ProgramCoursesResponse,
  ProgramDetail,
  ProgramAiRequirementsSummary,
  ProgramVariants,
  ProgramSummary,
  ProgramTab,
} from "@betteratlas/shared";

export function usePrograms(q: string) {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  qs.set("limit", "50");

  return useQuery({
    queryKey: ["programs", q],
    queryFn: () => api.get<ProgramSummary[]>(`/programs?${qs.toString()}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProgram(programId: number) {
  return useQuery({
    queryKey: ["program", programId],
    queryFn: () => api.get<ProgramDetail>(`/programs/${programId}`),
    enabled: programId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProgramVariants(programId: number) {
  return useQuery({
    queryKey: ["program", programId, "variants"],
    queryFn: () => api.get<ProgramVariants>(`/programs/${programId}/variants`),
    enabled: programId > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProgramAiSummary(programId: number) {
  return useQuery({
    queryKey: ["program", programId, "ai-summary"],
    queryFn: () =>
      api.get<ProgramAiRequirementsSummary>(`/programs/${programId}/ai-summary`),
    enabled: programId > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useProgramCourses(
  programId: number,
  tab: ProgramTab,
  params: Record<string, string>
) {
  const qs = new URLSearchParams({ ...params, tab }).toString();
  return useQuery({
    queryKey: ["program", programId, "courses", tab, params],
    queryFn: () =>
      api.get<ProgramCoursesResponse>(`/programs/${programId}/courses?${qs}`),
    enabled: programId > 0,
  });
}
