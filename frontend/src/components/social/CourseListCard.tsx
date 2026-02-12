import type { CourseListWithItems } from "@betteratlas/shared";

interface CourseListCardProps {
  list: CourseListWithItems;
}

export default function CourseListCard({ list }: CourseListCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-gray-900">{list.name}</h4>
        <span className="text-xs text-gray-500">{list.semester}</span>
      </div>
      {list.items.length === 0 ? (
        <p className="text-sm text-gray-400">No courses yet</p>
      ) : (
        <ul className="space-y-2">
          {list.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 text-sm"
            >
              {item.color && (
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="font-medium text-primary-600">
                {item.course.code}
              </span>
              <span className="text-gray-600 truncate">
                {item.course.title}
              </span>
              {item.section.sectionNumber && (
                <span className="text-gray-400 text-xs">
                  Sec {item.section.sectionNumber}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
