type ChatHeaderProps = {
  title?: string;
  hasTurns: boolean;
  onReset: () => void;
};

export function ChatHeader({
  title = "Atlas AI",
  hasTurns,
  onReset,
}: ChatHeaderProps) {
  void title;
  void hasTurns;
  void onReset;
  return null;
}
