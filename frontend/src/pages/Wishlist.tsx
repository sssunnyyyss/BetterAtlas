import { useState } from "react";
import { useMyWishlist, useRemoveFromWishlist, useMoveToSchedule } from "../hooks/useWishlist.js";
import type { WishlistItem } from "@betteratlas/shared";

export default function Wishlist() {
    const { data, isLoading, error } = useMyWishlist();
    const removeFromWishlist = useRemoveFromWishlist();
    const moveToSchedule = useMoveToSchedule();
    const [movingId, setMovingId] = useState<number | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-red-500 bg-red-50 rounded-lg p-4">Failed to load wishlist</div>
            </div>
        );
    }

    const items: WishlistItem[] = data?.items ?? [];
    const termName = data?.term?.name ?? data?.term?.code ?? "Current Term";

    return (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
                    <p className="text-sm text-gray-500 mt-1">{termName} · {items.length} course{items.length !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
                    <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <p className="mt-4 text-gray-500 text-sm">Your wishlist is empty</p>
                    <p className="text-gray-400 text-xs mt-1">Browse the catalog and add courses you're interested in</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => (
                        <WishlistCard
                            key={item.itemId}
                            item={item}
                            isMoving={movingId === item.itemId}
                            isRemoving={removingId === item.itemId}
                            onMove={() => {
                                setMovingId(item.itemId);
                                moveToSchedule.mutate(item.itemId, {
                                    onSettled: () => setMovingId(null),
                                });
                            }}
                            onRemove={() => {
                                setRemovingId(item.itemId);
                                removeFromWishlist.mutate(item.itemId, {
                                    onSettled: () => setRemovingId(null),
                                });
                            }}
                        />
                    ))}
                </div>
            )}
        </main>
    );
}

function WishlistCard({
    item,
    isMoving,
    isRemoving,
    onMove,
    onRemove,
}: {
    item: WishlistItem;
    isMoving: boolean;
    isRemoving: boolean;
    onMove: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {item.course.code}
                        </span>
                        {item.friendOverlapCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                                {item.friendOverlapCount} friend{item.friendOverlapCount !== 1 ? "s" : ""} also want this
                            </span>
                        )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1 text-sm leading-tight">{item.course.title}</h3>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                        {item.section.instructorName && (
                            <span>{item.section.instructorName}</span>
                        )}
                        {item.section.sectionNumber && (
                            <span>Section {item.section.sectionNumber}</span>
                        )}
                        {item.section.schedule?.days && item.section.schedule?.start && (
                            <span>{item.section.schedule.days} {item.section.schedule.start}–{item.section.schedule.end}</span>
                        )}
                        {item.section.enrollmentStatus && (
                            <span className={`font-medium ${item.section.enrollmentStatus === "O" ? "text-green-600" : "text-red-500"}`}>
                                {item.section.enrollmentStatus === "O" ? "Open" : "Closed"}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onMove}
                        disabled={isMoving || isRemoving}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {isMoving ? (
                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <>
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Schedule
                            </>
                        )}
                    </button>
                    <button
                        onClick={onRemove}
                        disabled={isMoving || isRemoving}
                        className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors rounded-lg hover:bg-red-50"
                        title="Remove from wishlist"
                    >
                        {isRemoving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                        ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
