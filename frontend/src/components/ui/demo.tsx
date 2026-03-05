import { useState } from "react";
import ClaudeChatInput, {
  type AttachedFile,
  type PastedSnippet,
} from "./claude-style-chat-input.js";

const ChatboxDemo = () => {
  const [messages, setMessages] = useState<string[]>([]);

  const handleSendMessage = (payload: {
    message: string;
    files: AttachedFile[];
    pastedContent: PastedSnippet[];
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    console.log("Sending message:", payload.message);
    console.log("Attached files:", payload.files);
    console.log("Pasted snippets:", payload.pastedContent);
    console.log("Model:", payload.model);
    console.log("Extended thinking:", payload.isThinkingEnabled);
    setMessages((prev) => [...prev, payload.message]);
  };

  const currentHour = new Date().getHours();
  let greeting = "Good morning";
  if (currentHour >= 12 && currentHour < 18) {
    greeting = "Good afternoon";
  } else if (currentHour >= 18) {
    greeting = "Good evening";
  }

  const userName = "Saify";

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#fcfcf9] p-4 font-sans text-text-100 transition-colors duration-200 dark:bg-[#202123]">
      <div className="mb-8 w-full max-w-3xl animate-fade-in text-center sm:mb-12">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl">
          <img
            src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=320&q=80"
            alt="Claude style demo"
            className="h-full w-full object-cover"
          />
        </div>
        <h1 className="mb-3 text-3xl font-light tracking-tight text-text-200 sm:text-4xl">
          {greeting},{" "}
          <span className="relative inline-block pb-2">
            {userName}
            <svg
              className="absolute -bottom-1 -left-[5%] h-[20px] w-[140%] text-[#D97757]"
              viewBox="0 0 140 24"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M6 16 Q 70 24, 134 14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
        </h1>
      </div>

      <ClaudeChatInput onSendMessage={handleSendMessage} />

      {messages.length > 0 ? (
        <div className="mt-4 w-full max-w-2xl rounded-xl border border-bg-300 bg-bg-100 p-3 text-sm text-text-200">
          Last sent: {messages[messages.length - 1]}
        </div>
      ) : null}
    </div>
  );
};

export default ChatboxDemo;
