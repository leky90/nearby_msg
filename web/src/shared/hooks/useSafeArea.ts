import { useMemo } from 'react';

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface UseSafeAreaReturn {
  safeAreaInsets: SafeAreaInsets;
  safeAreaStyles: {
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
  };
}

/**
 * Hook for handling iOS safe areas in PWA
 * Reads CSS environment variables for safe area insets
 */
export function useSafeArea(): UseSafeAreaReturn {
  const safeAreaInsets = useMemo<SafeAreaInsets>(() => {
    // CSS environment variables are read via getComputedStyle
    // For now, return defaults - actual values will be applied via CSS
    // The CSS env() variables will be used directly in Tailwind classes
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
  }, []);

  const safeAreaStyles = useMemo(() => {
    return {
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
    };
  }, []);

  return {
    safeAreaInsets,
    safeAreaStyles,
  };
}

