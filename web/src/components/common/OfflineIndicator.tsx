/**
 * Offline Indicator Component
 * Displays network connectivity status
 */

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';

export interface OfflineIndicatorProps {
  /** Custom className */
  className?: string;
}

/**
 * Offline Indicator component
 * Shows when the app is offline using shadcn Alert
 */
export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <Alert variant="default" className={cn('border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20', className)}>
      <WifiOff className="size-4" />
      <AlertDescription>
        Offline Mode - Using cached data
      </AlertDescription>
    </Alert>
  );
}

