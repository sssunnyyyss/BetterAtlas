interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export default function RatingStars({
  value,
  onChange,
  readonly = false,
  size = "md",
}: RatingStarsProps) {
  const starSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;

  function nextValueFromClick(
    star: number,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const chooseHalf = x < rect.width / 2;
    return chooseHalf ? star - 0.5 : star;
  }

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={(event) => {
            if (readonly) return;
            onChange?.(nextValueFromClick(star, event));
          }}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
        >
          <span className={`${starSize} relative block`}>
            <svg
              className={`${starSize} text-gray-300`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span
              className="absolute inset-0 overflow-hidden"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(1, normalized - (star - 1))
                ) * 100}%`,
              }}
            >
              <svg
                className={`${starSize} text-yellow-400`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
