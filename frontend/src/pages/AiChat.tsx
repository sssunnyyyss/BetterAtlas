import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useAiCourseRecommendations,
  type AiMessage,
  type AiCourseRecommendation,
  type AiPreferenceCourse,
} from "../hooks/useAi.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      recommendations: AiCourseRecommendation[];
      followUp: string | null;
    };

const PREFERENCES_KEY = "betteratlas.ai.preferences.v1";

type StoredPreferences = {
  liked: AiPreferenceCourse[];
  disliked: AiPreferenceCourse[];
};

// ---------------------------------------------------------------------------
// Suggestion chips shown on the welcome screen
// ---------------------------------------------------------------------------

const SUGGESTION_CHIPS = [
  "Find easy GER classes",
  "Help me plan next semester",
  "Best CS classes",
  "Low-workload electives",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPreferences(): StoredPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPreferences;
      return {
        liked: Array.isArray(parsed.liked) ? parsed.liked : [],
        disliked: Array.isArray(parsed.disliked) ? parsed.disliked : [],
      };
    }
  } catch {
    // ignore
  }
  return { liked: [], disliked: [] };
}

function fitScoreColor(score: number): string {
  if (score >= 8) return "bg-green-100 text-green-800";
  if (score >= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function formatRating(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 mb-4">
      <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function CourseCard({ rec }: { rec: AiCourseRecommendation }) {
  const { course, fitScore, why } = rec;
  return (
    <Link
      to={`/catalog/${course.id}`}
      className="block border border-gray-200 rounded-xl p-3 hover:border-primary-400 hover:shadow-sm transition-all bg-white"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {course.code}
          </p>
          <p className="text-sm text-gray-600 truncate">{course.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {course.classScore != null && (
            <span className="text-xs text-gray-500">
              ★ {formatRating(course.classScore)}
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${fitScoreColor(fitScore)}`}
          >
            {fitScore}/10
          </span>
        </div>
      </div>
      {why.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {why.slice(0, 2).map((reason, i) => (
            <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
              <span className="shrink-0 mt-0.5">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

function ErrorBubble() {
  return (
    <div className="flex items-start gap-2 mb-4">
      <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
        <p className="text-sm text-red-700">
          Something went wrong. Please try again.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AiChat() {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [showError, setShowError] = useState(false);

  // Preferences from localStorage
  const [likedCourses] = useState<AiPreferenceCourse[]>(
    () => loadPreferences().liked,
  );
  const [dislikedCourses] = useState<AiPreferenceCourse[]>(
    () => loadPreferences().disliked,
  );

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mutation
  const aiRec = useAiCourseRecommendations();

  // Auto-scroll on new messages or when loading
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiRec.isPending]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setShowError(false);

      // Add user message to display
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      // Clear input & reset textarea
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Build API messages (keep last 12)
      const newAiMessages: AiMessage[] = [
        ...aiMessages,
        { role: "user" as const, content: trimmed },
      ].slice(-12);
      setAiMessages(newAiMessages);

      // Call API
      aiRec.mutate(
        {
          messages: newAiMessages,
          preferences:
            likedCourses.length > 0 || dislikedCourses.length > 0
              ? { liked: likedCourses, disliked: dislikedCourses }
              : undefined,
        },
        {
          onSuccess: (data) => {
            const assistantMsg: ChatMessage = {
              role: "assistant",
              content: data.assistantMessage,
              recommendations: data.recommendations,
              followUp: data.followUpQuestion,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setAiMessages((prev) => [
              ...prev,
              { role: "assistant" as const, content: data.assistantMessage },
            ]);
          },
          onError: () => {
            setShowError(true);
          },
        },
      );
    },
    [aiMessages, aiRec, likedCourses, dislikedCourses],
  );

  // -----------------------------------------------------------------------
  // Deep-link: auto-send ?prompt= query param as first message
  // -----------------------------------------------------------------------

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (prompt && messages.length === 0) {
      sendMessage(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // resetChat
  // -----------------------------------------------------------------------

  const resetChat = useCallback(() => {
    setMessages([]);
    setAiMessages([]);
    setInput("");
    setShowError(false);
    aiRec.mutate({ reset: true });
  }, [aiRec]);

  // -----------------------------------------------------------------------
  // Input handlers
  // -----------------------------------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!aiRec.isPending && input.trim()) {
        sendMessage(input);
      }
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto w-full">
      {/* ---- Chat header ---- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Atlas AI</h1>
        </div>
        {hasMessages && (
          <button
            onClick={resetChat}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            New chat
          </button>
        )}
      </div>

      {/* ---- Message area ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          /* ---- Welcome screen ---- */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Atlas AI
            </h2>
            <p className="text-gray-500 text-sm max-w-sm mb-8">
              I can help you find the perfect classes. Tell me what you're
              looking for, or try one of the suggestions below.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="text-sm text-left px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50 transition-colors text-gray-700"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ---- Message list ---- */
          <div className="space-y-4">
            {messages.map((msg, idx) =>
              msg.role === "user" ? (
                /* User message */
                <div key={idx} className="flex justify-end">
                  <div className="bg-primary-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ) : (
                /* Assistant message */
                <div key={idx} className="space-y-2">
                  {/* Main text */}
                  <div className="flex items-start gap-2">
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>

                  {/* Course cards */}
                  {msg.recommendations.length > 0 && (
                    <div className="pl-0 grid gap-2 sm:grid-cols-2 max-w-[80%]">
                      {msg.recommendations.map((rec) => (
                        <CourseCard key={rec.course.id} rec={rec} />
                      ))}
                    </div>
                  )}

                  {/* Follow-up question */}
                  {msg.followUp && (
                    <div className="flex items-start gap-2">
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                        <p className="text-sm text-gray-600 italic">
                          {msg.followUp}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}

            {/* Typing indicator */}
            {aiRec.isPending && <TypingIndicator />}

            {/* Error state */}
            {showError && <ErrorBubble />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ---- Input area ---- */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
          <div className="flex items-end gap-2 p-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about classes..."
              rows={1}
              className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-gray-900 placeholder:text-gray-400 px-2 py-1.5 max-h-[150px]"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || aiRec.isPending}
              className="shrink-0 w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
                />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          AI results can be inaccurate. Always verify course details in the
          catalog.
        </p>
      </div>
    </div>
  );
}
