export interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourOverlayProps {
  rect: HighlightRect | null;
}

const HIGHLIGHT_PADDING = 8;

export default function TourOverlay({ rect }: TourOverlayProps) {
  if (!rect) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[70] bg-slate-950/72"
        aria-hidden="true"
      />
    );
  }

  const top = Math.max(6, rect.top - HIGHLIGHT_PADDING);
  const left = Math.max(6, rect.left - HIGHLIGHT_PADDING);
  const width = Math.max(40, rect.width + HIGHLIGHT_PADDING * 2);
  const height = Math.max(40, rect.height + HIGHLIGHT_PADDING * 2);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
      <div
        className="absolute rounded-xl border-2 border-primary-400 shadow-[0_0_32px_rgba(59,130,246,0.35)] transition-all duration-200 ease-out"
        style={{
          top,
          left,
          width,
          height,
          boxShadow:
            "0 0 0 9999px rgba(2, 6, 23, 0.72), 0 0 32px rgba(59, 130, 246, 0.35)",
        }}
      />
    </div>
  );
}
