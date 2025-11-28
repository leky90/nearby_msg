import { useRef, useState, useCallback } from 'react';

export interface SwipeGestureOptions {
  /** Minimum distance in pixels to trigger a swipe */
  threshold?: number;
  /** Maximum time in milliseconds for a swipe gesture */
  maxDuration?: number;
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void;
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void;
  /** Callback when swipe up is detected */
  onSwipeUp?: () => void;
  /** Callback when swipe down is detected */
  onSwipeDown?: () => void;
  /** Whether to prevent default touch behavior */
  preventDefault?: boolean;
}

export interface SwipeGestureReturn {
  /** Props to spread on the target element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Current swipe state */
  isSwiping: boolean;
  /** Swipe direction if detected */
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

/**
 * Hook for detecting swipe gestures on touch devices
 * Supports horizontal (left/right) and vertical (up/down) swipes
 */
export function useSwipeGesture(options: SwipeGestureOptions = {}): SwipeGestureReturn {
  const {
    threshold = 50,
    maxDuration = 300,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    preventDefault = true,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (preventDefault) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      setIsSwiping(true);
      setDirection(null);
    },
    [preventDefault]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    if (preventDefault) {
      e.preventDefault();
    }
  }, [preventDefault]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      if (preventDefault) {
        e.preventDefault();
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Reset state
      setIsSwiping(false);
      setDirection(null);

      // Check if gesture meets criteria
      if (deltaTime > maxDuration) {
        touchStartRef.current = null;
        return;
      }

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Determine primary direction
      if (absX > absY && absX > threshold) {
        // Horizontal swipe
        if (deltaX > 0) {
          setDirection('right');
          onSwipeRight?.();
        } else {
          setDirection('left');
          onSwipeLeft?.();
        }
      } else if (absY > absX && absY > threshold) {
        // Vertical swipe
        if (deltaY > 0) {
          setDirection('down');
          onSwipeDown?.();
        } else {
          setDirection('up');
          onSwipeUp?.();
        }
      }

      touchStartRef.current = null;
    },
    [threshold, maxDuration, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, preventDefault]
  );

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isSwiping,
    direction,
  };
}
