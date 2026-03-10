import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Typewriter } from "../components/ui/typewriter.js";
import { AuroraBackground } from "../components/ui/aurora-background.js";
import "./Home.css";

const HOME_TYPEWRITER_TEXT = [
  "BetterAtlas",
  "Emory's first student run atlas",
  "a new generation of course search",
];

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"search" | "ai">("search");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      navigate(mode === "ai" ? "/ai" : "/catalog");
      return;
    }
    if (mode === "ai") navigate("/ai");
    else navigate(`/catalog?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="home-root">
      <AuroraBackground className="home-bg" />

      <main className="relative home-main">
        <section className="home-hero mx-auto max-w-5xl px-5 sm:px-8 text-center">
          <div className="home-kicker">Beta release</div>

          <h1 className="home-title">
            <span className="home-titleStatic">Welcome to </span>
            <span className="home-titleDynamicWrap">
              <Typewriter
                text={HOME_TYPEWRITER_TEXT}
                speed={210}
                className="home-titleTypewriter"
                waitTime={2600}
                deleteSpeed={120}
                cursorChar="_"
              />
            </span>
          </h1>

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
      </main>
    </div>
  );
}
