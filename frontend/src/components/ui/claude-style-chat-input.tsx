import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import {
  Plus,
  ChevronDown,
  ArrowUp,
  X,
  FileText,
  Loader2,
  Check,
  Archive,
} from "lucide-react";

/* --- ICONS --- */
export const Icons = {
  Logo: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      {...props}
    >
      <defs>
        <ellipse id="petal-pair" cx="100" cy="100" rx="90" ry="22" />
      </defs>
      <g fill="#D46B4F" fillRule="evenodd">
        <use href="#petal-pair" transform="rotate(0 100 100)" />
        <use href="#petal-pair" transform="rotate(45 100 100)" />
        <use href="#petal-pair" transform="rotate(90 100 100)" />
        <use href="#petal-pair" transform="rotate(135 100 100)" />
      </g>
    </svg>
  ),
  Plus,
  Thinking: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z" />
    </svg>
  ),
  SelectArrow: ChevronDown,
  ArrowUp,
  X,
  FileText,
  Loader2,
  Check,
  Archive,
  Clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z" />
    </svg>
  ),
};

/* --- UTILS --- */
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const createId = () => Math.random().toString(36).slice(2, 11);

const revokePreview = (preview: string | null) => {
  if (preview && preview.startsWith("blob:")) {
    URL.revokeObjectURL(preview);
  }
};

/* --- TYPES --- */
type UploadStatus = "uploading" | "complete";

export interface AttachedFile {
  id: string;
  file: File;
  type: string;
  preview: string | null;
  uploadStatus: UploadStatus;
  content?: string;
}

export interface PastedSnippet {
  id: string;
  content: string;
  timestamp: Date;
}

interface Model {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export interface ClaudeSendPayload {
  message: string;
  files: AttachedFile[];
  pastedContent: PastedSnippet[];
  model: string;
  isThinkingEnabled: boolean;
}

type ClaudeChatInputProps = {
  onSendMessage: (data: ClaudeSendPayload) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  isSending?: boolean;
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  testIds?: {
    shell?: string;
    textarea?: string;
    sendButton?: string;
  };
};

/* --- COMPONENTS --- */
interface FilePreviewCardProps {
  file: AttachedFile;
  onRemove: (id: string) => void;
}

const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, onRemove }) => {
  const isImage = file.type.startsWith("image/") && file.preview;

  return (
    <div className="relative group flex-shrink-0 h-24 w-24 animate-fade-in overflow-hidden rounded-xl border border-bg-300 bg-bg-200 transition-all hover:border-text-400">
      {isImage ? (
        <div className="relative h-full w-full">
          <img
            src={file.preview ?? undefined}
            alt={file.file.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/0" />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="rounded bg-bg-300 p-1.5">
              <Icons.FileText className="h-4 w-4 text-text-300" />
            </div>
            <span className="truncate text-[10px] font-medium uppercase tracking-wider text-text-400">
              {file.file.name.split(".").pop()}
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="truncate text-xs font-medium text-text-200" title={file.file.name}>
              {file.file.name}
            </p>
            <p className="text-[10px] text-text-500">{formatFileSize(file.file.size)}</p>
          </div>
        </div>
      )}

      <button
        onClick={() => onRemove(file.id)}
        className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
      >
        <Icons.X className="h-3 w-3" />
      </button>

      {file.uploadStatus === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Icons.Loader2 className="h-5 w-5 animate-spin text-white" />
        </div>
      )}
    </div>
  );
};

interface PastedContentCardProps {
  content: PastedSnippet;
  onRemove: (id: string) => void;
}

const PastedContentCard: React.FC<PastedContentCardProps> = ({
  content,
  onRemove,
}) => {
  return (
    <div className="relative group flex h-28 w-28 flex-shrink-0 animate-fade-in flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:border-[#30302E] dark:bg-[#20201F]">
      <div className="w-full overflow-hidden">
        <p className="line-clamp-4 select-none whitespace-pre-wrap break-words font-mono text-[10px] leading-[1.4] text-[#9CA3AF]">
          {content.content}
        </p>
      </div>

      <div className="mt-2 flex w-full items-center justify-between">
        <div className="inline-flex items-center justify-center rounded border border-[#E5E5E5] bg-white px-1.5 py-[2px] dark:border-[#404040] dark:bg-transparent">
          <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
            PASTED
          </span>
        </div>
      </div>

      <button
        onClick={() => onRemove(content.id)}
        className="absolute right-2 top-2 rounded-full border border-[#E5E5E5] bg-white p-[3px] text-[#9CA3AF] opacity-0 shadow-sm transition-colors hover:text-[#6B7280] group-hover:opacity-100 dark:border-[#404040] dark:bg-[#30302E] dark:hover:text-white"
      >
        <Icons.X className="h-2 w-2" />
      </button>
    </div>
  );
};

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find((m) => m.id === selectedModel) ?? models[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex h-8 min-w-[4rem] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl pl-2.5 pr-2 text-xs font-base transition duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] active:scale-[0.98]
          ${
            isOpen
              ? "bg-bg-200 text-text-100 dark:bg-[#454540] dark:text-[#ECECEC]"
              : "text-text-300 hover:bg-bg-200 hover:text-text-200 dark:text-[#B4B4B4] dark:hover:bg-[#454540] dark:hover:text-[#ECECEC]"
          }`}
        type="button"
      >
        <div className="font-ui inline-flex h-[14px] items-baseline gap-[3px] text-[14px] leading-none">
          <div className="flex items-center gap-[4px]">
            <div className="select-none whitespace-nowrap font-medium">
              {currentModel.name}
            </div>
          </div>
        </div>
        <div
          className="flex items-center justify-center opacity-75"
          style={{ width: "20px", height: "20px" }}
        >
          <Icons.SelectArrow
            className={`shrink-0 opacity-75 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-2 flex w-[260px] origin-bottom-right animate-fade-in flex-col overflow-hidden rounded-2xl border border-[#DDDDDD] bg-white p-1.5 shadow-2xl dark:border-[#30302E] dark:bg-[#212121]">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onSelect(model.id);
                setIsOpen(false);
              }}
              className="group flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-bg-200 dark:hover:bg-[#30302E]"
              type="button"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-100 dark:text-[#ECECEC]">
                    {model.name}
                  </span>
                  {model.badge && (
                    <span
                      className={`rounded-full border px-1.5 py-[1px] text-[10px] font-medium ${
                        model.badge === "Upgrade"
                          ? "border-blue-200 bg-white text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-bg-300 text-text-300"
                      }`}
                    >
                      {model.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-text-300 dark:text-[#999999]">
                  {model.description}
                </span>
              </div>
              {selectedModel === model.id && (
                <Icons.Check className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
            </button>
          ))}

          <div className="mx-2 my-1 h-px bg-bg-300 dark:bg-[#30302E]" />

          <button
            className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-text-100 transition-colors hover:bg-bg-200 dark:text-[#ECECEC] dark:hover:bg-[#30302E]"
            type="button"
          >
            <span className="text-[13px] font-semibold">More models</span>
            <Icons.SelectArrow className="-rotate-90 h-4 w-4 text-text-300 dark:text-[#999999]" />
          </button>
        </div>
      )}
    </div>
  );
};

export const ClaudeChatInput: React.FC<ClaudeChatInputProps> = ({
  onSendMessage,
  value,
  onValueChange,
  isSending = false,
  textareaRef,
  testIds,
}) => {
  const [internalMessage, setInternalMessage] = useState(value ?? "");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [pastedContent, setPastedContent] = useState<PastedSnippet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel, setSelectedModel] = useState("sonnet-4.5");
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);

  const textareaInternalRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<AttachedFile[]>([]);

  const message = value ?? internalMessage;
  const isControlled = value !== undefined;

  const setTextareaNode = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaInternalRef.current = node;
      if (textareaRef) {
        textareaRef.current = node;
      }
    },
    [textareaRef],
  );

  const setMessage = useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalMessage(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  const models: Model[] = [
    {
      id: "opus-4.5",
      name: "Opus 4.5",
      description: "Most capable for complex work",
    },
    {
      id: "sonnet-4.5",
      name: "Sonnet 4.5",
      description: "Best for everyday tasks",
    },
    { id: "haiku-4.5", name: "Haiku 4.5", description: "Fastest for quick answers" },
  ];

  useEffect(() => {
    const textarea = textareaInternalRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 384)}px`;
  }, [message]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => revokePreview(file.preview));
    };
  }, []);

  const clearArtifacts = useCallback((attachedFiles: AttachedFile[]) => {
    attachedFiles.forEach((file) => revokePreview(file.preview));
    setFiles([]);
    setPastedContent([]);
  }, []);

  const handleFiles = useCallback(
    (newFilesList: FileList | File[]) => {
      const newFiles = Array.from(newFilesList).map((file) => {
        const isImage =
          file.type.startsWith("image/") ||
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
        return {
          id: createId(),
          file,
          type: isImage ? "image/unknown" : file.type || "application/octet-stream",
          preview: isImage ? URL.createObjectURL(file) : null,
          uploadStatus: "uploading" as UploadStatus,
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);

      if (!message.trim()) {
        if (newFiles.length === 1) {
          setMessage(
            newFiles[0].type.startsWith("image/")
              ? "Analyzed image..."
              : "Analyzed document...",
          );
        } else {
          setMessage(`Analyzed ${newFiles.length} files...`);
        }
      }

      newFiles.forEach((uploadedFile) => {
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((file) =>
              file.id === uploadedFile.id ? { ...file, uploadStatus: "complete" } : file,
            ),
          );
        }, 800 + Math.random() * 1000);
      });
    },
    [message, setMessage],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((file) => file.id === id);
      if (target) revokePreview(target.preview);
      return prev.filter((file) => file.id !== id);
    });
  }, []);

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    const pastedFiles: File[] = [];
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].kind === "file") {
        const file = items[index].getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      event.preventDefault();
      handleFiles(pastedFiles);
      return;
    }

    const text = event.clipboardData.getData("text");
    if (text.length > 300) {
      event.preventDefault();
      const snippet: PastedSnippet = {
        id: createId(),
        content: text,
        timestamp: new Date(),
      };
      setPastedContent((prev) => [...prev, snippet]);
      if (!message.trim()) {
        setMessage("Analyzed pasted text...");
      }
    }
  };

  const handleSend = useCallback(() => {
    if (!message.trim() && files.length === 0 && pastedContent.length === 0) return;
    if (isSending) return;

    const payloadFiles = [...files];
    onSendMessage({
      message,
      files,
      pastedContent,
      model: selectedModel,
      isThinkingEnabled,
    });
    setMessage("");
    clearArtifacts(payloadFiles);
    if (textareaInternalRef.current) {
      textareaInternalRef.current.style.height = "auto";
    }
  }, [
    clearArtifacts,
    files,
    isSending,
    isThinkingEnabled,
    message,
    onSendMessage,
    pastedContent,
    selectedModel,
    setMessage,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const hasContent =
    message.trim().length > 0 || files.length > 0 || pastedContent.length > 0;

  const localThemeVars: CSSProperties = {
    "--bg-0": "43 39% 97%",
    "--bg-000": "43 39% 97%",
    "--bg-100": "0 0% 100%",
    "--bg-200": "48 21% 92%",
    "--bg-300": "0 0% 87%",
    "--text-100": "30 5% 12%",
    "--text-200": "30 1% 24%",
    "--text-300": "57 3% 43%",
    "--text-400": "0 0% 53%",
    "--text-500": "0 0% 60%",
    "--accent": "15 63% 59%",
    "--accent-hover": "15 53% 51%",
  } as CSSProperties;

  return (
    <div
      className="relative mx-auto w-full max-w-2xl font-sans transition-all duration-300"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={localThemeVars}
      data-testid={testIds?.shell}
    >
      <div
        className="!box-content relative z-10 mx-2 flex cursor-text flex-col items-stretch rounded-2xl border border-bg-300 bg-white font-sans antialiased shadow-[0_0_15px_rgba(0,0,0,0.08)] transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,0,0,0.12)] focus-within:shadow-[0_0_25px_rgba(0,0,0,0.15)] dark:border-transparent dark:bg-[#30302E] md:mx-0"
      >
        <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
          {(files.length > 0 || pastedContent.length > 0) && (
            <div className="custom-scrollbar flex gap-3 overflow-x-auto px-1 pb-2">
              {pastedContent.map((content) => (
                <PastedContentCard
                  key={content.id}
                  content={content}
                  onRemove={(id) =>
                    setPastedContent((prev) =>
                      prev.filter((snippet) => snippet.id !== id),
                    )
                  }
                />
              ))}
              {files.map((file) => (
                <FilePreviewCard key={file.id} file={file} onRemove={removeFile} />
              ))}
            </div>
          )}

          <div className="relative mb-1">
            <div className="custom-scrollbar min-h-[2.5rem] w-full max-h-96 overflow-y-auto break-words pl-1 font-sans transition-opacity duration-200">
              <textarea
                data-testid={testIds?.textarea}
                ref={setTextareaNode}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder="How can I help you today?"
                className="ba-chat-composer-textarea block w-full resize-none overflow-hidden border-0 bg-transparent py-0 text-[16px] font-normal leading-relaxed text-text-100 antialiased outline-none placeholder:text-text-400"
                rows={1}
                autoFocus
                style={{ minHeight: "1.5em" }}
              />
            </div>
          </div>

          <div className="flex w-full items-center gap-2">
            <div className="relative flex min-w-0 shrink flex-1 items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-400 transition-colors duration-200 hover:bg-bg-200 hover:text-text-200 active:scale-95"
                type="button"
                aria-label="Attach files"
              >
                <Icons.Plus className="h-5 w-5" />
              </button>

              <div className="!shrink-0 flex min-w-8 shrink">
                <button
                  onClick={() => setIsThinkingEnabled((enabled) => !enabled)}
                  className={`group relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 ${
                    isThinkingEnabled
                      ? "bg-accent/10 text-accent"
                      : "text-text-400 hover:bg-bg-200 hover:text-text-200"
                  }`}
                  aria-pressed={isThinkingEnabled}
                  aria-label="Extended thinking"
                  type="button"
                >
                  <Icons.Thinking className="h-5 w-5" />
                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-[6px] bg-[#1F1E1D] px-2 py-1 text-[11px] font-medium text-bg-0 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:bg-[#EEEEEC] dark:text-bg-100">
                    <span className="text-[#ECECEC] dark:text-[#1F1E1D]">Extended thinking</span>
                    <span
                      className="text-[#999999] opacity-80 dark:text-[#73726C]"
                      style={{ fontSize: "10px" }}
                    >
                      ⇧+Ctrl+E
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-row items-center gap-1">
              <div className="-m-1 shrink-0 p-1">
                <ModelSelector
                  models={models}
                  selectedModel={selectedModel}
                  onSelect={setSelectedModel}
                />
              </div>

              <div>
                <button
                  data-testid={testIds?.sendButton}
                  onClick={handleSend}
                  disabled={!hasContent || isSending}
                  className={`ba-chat-focus-ring !h-8 !w-8 !rounded-xl inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors active:scale-95 ${
                    hasContent && !isSending
                      ? "bg-accent text-bg-0 hover:bg-accent-hover shadow-md"
                      : "cursor-default bg-accent/30 text-bg-0/60"
                  }`}
                  type="button"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Icons.Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-bg-200/90 backdrop-blur-sm">
          <Icons.Archive className="mb-2 h-10 w-10 animate-bounce text-accent" />
          <p className="font-medium text-accent">Drop files to upload</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        multiple
        onChange={(event) => {
          if (event.target.files) {
            handleFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />

      <div className="mt-4 text-center">
        <p className="text-xs text-text-500">
          AI can make mistakes. Please check important information.
        </p>
      </div>
    </div>
  );
};

export default ClaudeChatInput;
