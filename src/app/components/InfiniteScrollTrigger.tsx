"use client";

import { useEffect, useRef } from 'react';

interface InfiniteScrollTriggerProps {
  onVisible: () => void;
  hasMore: boolean;
  isLoadingNext?: boolean; // Optional: to show a loading state
}

export default function InfiniteScrollTrigger({
  onVisible,
  hasMore,
  isLoadingNext,
}: InfiniteScrollTriggerProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || isLoadingNext) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onVisible();
        }
      },
      { threshold: 1.0 } // Trigger when 100% of the sentinel is visible
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observerRef.current.observe(currentSentinel);
    }

    return () => {
      if (observerRef.current && currentSentinel) {
        observerRef.current.unobserve(currentSentinel);
      }
    };
  }, [onVisible, hasMore, isLoadingNext]);

  return (
    <div ref={sentinelRef} style={{ height: '1px', marginTop: '20px' }}>
      {hasMore && isLoadingNext && <p className="text-center text-gray-500 py-4">Loading more...</p>}
      {!hasMore && <p className="text-center text-gray-500 py-4">No more hotels to load.</p>}
    </div>
  );
} 