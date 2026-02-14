import { GER_TAGS } from "@betteratlas/shared";

const DEFAULT_MAX_VISIBLE_TAGS = 3;

export default function GerPills({
  gers,
  maxVisible = DEFAULT_MAX_VISIBLE_TAGS,
}: {
  gers: string[] | undefined;
  maxVisible?: number;
}) {
  const gerTags = gers ?? [];
  if (gerTags.length === 0) return null;

  const visibleTags = gerTags.slice(0, maxVisible);
  const overflowCount = gerTags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full"
        >
          {GER_TAGS[tag] ?? tag}
        </span>
      ))}
      {overflowCount > 0 && (
        <span className="text-xs text-gray-400 px-1 py-0.5">
          +{overflowCount} more
        </span>
      )}
    </div>
  );
}

