/**
 * Offline Indicator Component
 * Displays network connectivity status
 */

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

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
    <Alert variant="default" className={cn('border-muted-semantic bg-muted-semantic/10 text-muted-foreground', className)}>
      <WifiOff className="size-4" />
      <AlertDescription className="text-body leading-body">
        {t("network.offline") || "Chế độ ngoại tuyến - Đang sử dụng dữ liệu đã lưu"}
      </AlertDescription>
    </Alert>
  );
}

