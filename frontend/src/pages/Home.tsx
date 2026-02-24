import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCourses } from "../hooks/useCourses.js";
import type { CourseWithRatings } from "@betteratlas/shared";
import RatingBadge from "../components/course/RatingBadge.js";
import GerPills from "../components/course/GerPills.js";
import "./Home.css";

function shuffle<T>(arr: T[]) {
  // Fisher-Yates
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"search" | "ai">("search");

  const coursesQuery = useCourses({ page: "1", limit: "100", sort: "code" });

  const tickerCourses = useMemo(() => {
    const courses = coursesQuery.data?.data ?? [];
    if (courses.length === 0) return [];
    return shuffle(courses).slice(0, 30);
  }, [coursesQuery.data]);

  // Keep the ticker from feeling "stuck" if the app hot-reloads or the user
  // returns to this page frequently during a session.
  const [seed, setSeed] = useState(0);
  useEffect(() => setSeed((s) => s + 1), []);
  const tickerKey = `${seed}-${tickerCourses.map((c) => c.id).join(",")}`;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      navigate("/catalog");
      return;
    }
    if (mode === "ai") navigate(`/ai?prompt=${encodeURIComponent(trimmed)}`);
    else navigate(`/catalog?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="home-root">
      <div className="home-bg" aria-hidden="true" />

      <main className="relative home-main">
        <section className="home-hero mx-auto max-w-5xl px-5 sm:px-8 text-center">
          <div className="home-kicker">Beta 1.0.0 release!</div>

          <h1 className="home-title">
            Welcome to <span className="home-titleAccent">BetterAtlas</span>!
          </h1>

          <p className="home-tagline">Emory's first student run course catalogue</p>

          <form onSubmit={onSubmit} className="home-searchWrap">
            <div
              className="home-modeToggle"
              aria-label="Search mode"
              style={{ ["--home-mode-index" as any]: mode === "ai" ? 1 : 0 }}
            >
              <span className="home-modeGlider" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setMode("search")}
                className={`home-modeBtn ${mode === "search" ? "home-modeBtnActive" : ""}`}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`home-modeBtn ${mode === "ai" ? "home-modeBtnActive" : ""}`}
              >
                Ask AI
              </button>
            </div>

            <div className={`home-search ${mode === "ai" ? "home-searchAi" : ""}`}>
              <span className="home-searchIcon" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M21 21l-4.35-4.35"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="home-searchInput"
                placeholder={
                  mode === "ai"
                    ? 'Tell me your goals: "I want a chill writing class", "I like bio + philosophy"...'
                    : 'Search by anything: "CS 170", "Eisen", "writing", "QTM"...'
                }
                autoComplete="off"
                spellCheck={false}
                aria-label="Search courses"
              />

              <button type="submit" className="home-searchBtn">
                {mode === "ai" ? "Ask" : "Search"}
              </button>
            </div>

            <div className="home-searchHint">
              {mode === "ai"
                ? "Describe what you like, what you want, and your constraints. We’ll suggest courses you can click into."
                : "Profs, course code, department, attributes, vibes. If it exists, we try to find it."}
              <Link className="home-browseLink" to="/catalog">
                Browse the full catalog
              </Link>
              .
            </div>
          </form>
        </section>

        <section className="home-marqueeSection mx-auto max-w-6xl px-5 sm:px-8 pb-16 sm:pb-20">
          <h2 className="home-marqueeLabel">Some offerings (scrolling forever)</h2>

          <div className="home-marquee" role="region" aria-label="Course ticker">
            <div
              key={tickerKey}
              className="home-marqueeTrack"
              style={
                {
                  ["--duration" as any]: tickerCourses.length > 0 ? "260s" : "90s",
                } as CSSProperties
              }
            >
              {(tickerCourses.length > 0
                ? tickerCourses
                : Array.from({ length: 18 }).map((_, i) => ({
                    id: -i - 1,
                    code: "Loading",
                    title: "Pulling courses...",
                  }))) // keeps motion while data loads
                .concat(
                  tickerCourses.length > 0
                    ? tickerCourses
                    : Array.from({ length: 18 }).map((_, i) => ({
                        id: -i - 100,
                        code: "Loading",
                        title: "Pulling courses...",
                      }))
                )
                .map((c: CourseWithRatings | { id: number; code: string; title: string }, idx) => {
                  const href = c.id > 0 ? `/catalog/${c.id}` : undefined;
                  const asCourse = c as CourseWithRatings;
                  const instructors = asCourse.instructors ?? [];
                  return href ? (
                    <Link key={`${c.id}-${idx}`} to={href} className="home-card">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-primary-600">
                              {asCourse.code}
                            </span>
                            {asCourse.credits && (
                              <span className="text-sm text-gray-400">
                                {asCourse.credits} cr
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-lg text-gray-900 mt-0.5 truncate">
                            {asCourse.title}
                          </div>
                          {instructors.length > 0 && (
                            <div className="text-sm text-gray-500 mt-0.5 truncate">
                              {instructors.slice(0, 2).join(", ")}
                              {instructors.length > 2 ? ` +${instructors.length - 2}` : ""}
                            </div>
                          )}
                          <GerPills gers={asCourse.gers} maxVisible={2} />
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <RatingBadge value={asCourse.classScore ?? null} label="Class" size="sm" />
                          <RatingBadge value={asCourse.avgDifficulty ?? null} label="Diff" size="sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-400">
                          {asCourse.reviewCount ?? 0} review{(asCourse.reviewCount ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div
                      key={`${c.id}-${idx}`}
                      className="home-card home-cardLoading"
                      aria-hidden="true"
                    >
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                        <div className="h-5 bg-gray-200 rounded w-5/6 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                        <div className="flex gap-2">
                          <div className="h-6 w-10 bg-gray-200 rounded" />
                          <div className="h-6 w-10 bg-gray-200 rounded" />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {coursesQuery.isError && (
            <p className="mt-3 text-base text-red-700">
              Couldn’t load courses for the ticker. The catalog search still works.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
