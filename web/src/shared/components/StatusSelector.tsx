/**
 * Status Selector Component
 * Allows users to select and update their safety status
 */

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import type { StatusType, UserStatus } from "@/shared/domain/user_status";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { Button } from "@/shared/components/ui/button";
import { log } from "@/shared/lib/logging/logger";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { useDispatch, useSelector } from "react-redux";
import { selectUserStatus, updateUserStatusOptimistic, setUserStatus } from "@/features/navigation/store/appSlice";
import { updateUserStatusAction, fetchUserStatusAction } from "@/features/status/store/statusSaga";
import type { RootState } from "@/store";

export interface StatusSelectorProps {
  /** Callback when status is updated */
  onStatusUpdated?: (status: UserStatus) => void;
  /** Custom className */
  className?: string;
}

const getStatusOptions = (): Array<{
  type: StatusType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> => [
  {
    type: "safe",
    label: t("status.safe"),
    icon: <CheckCircle2 className="size-5" />,
    color: "text-green-600",
    description: t("status.description.safe"),
  },
  {
    type: "need_help",
    label: t("status.needHelp"),
    icon: <AlertCircle className="size-5" />,
    color: "text-yellow-600",
    description: t("status.description.needHelp"),
  },
  {
    type: "cannot_contact",
    label: t("status.cannotContact"),
    icon: <XCircle className="size-5" />,
    color: "text-red-600",
    description: t("status.description.cannotContact"),
  },
];

/**
 * Status Selector component
 * Allows users to select and update their safety status
 */
export function StatusSelector({
  onStatusUpdated,
  className = "",
}: StatusSelectorProps) {
  const dispatch = useDispatch();
  const deviceId = getOrCreateDeviceId();
  const currentStatus = useSelector((state: RootState) => selectUserStatus(state));
  const [selectedType, setSelectedType] = useState<StatusType | null>(null);
  const [description, setDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const STATUS_OPTIONS = getStatusOptions();

  // Fetch status on mount if not in Redux
  useEffect(() => {
    if (!currentStatus) {
      dispatch(fetchUserStatusAction());
    }
  }, [currentStatus, dispatch]);

  // Initialize form when status loads
  useEffect(() => {
    if (currentStatus) {
      setSelectedType(currentStatus.status_type);
      setDescription(currentStatus.description || "");
    }
  }, [currentStatus]);

  const handleStatusSelect = (type: StatusType) => {
    setSelectedType(type);
  };

  const handleUpdate = async () => {
    if (!selectedType) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    // Optimistic update - update Redux state immediately
    const previousStatus = currentStatus;
    dispatch(updateUserStatusOptimistic({
      statusType: selectedType,
      description: description.trim() || undefined,
    }));

    try {
      // Dispatch action to update status (saga handles API call)
      dispatch(updateUserStatusAction({
        statusType: selectedType,
        description: description.trim() || undefined,
      }));

      // Wait a bit for saga to complete and update state
      // The saga will call setUserStatus with the actual response
      // For now, we'll rely on the optimistic update
      onStatusUpdated?.(currentStatus || {
        id: '',
        device_id: deviceId,
        status_type: selectedType,
        description: description.trim() || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      // Rollback optimistic update on error
      if (previousStatus) {
        dispatch(setUserStatus(previousStatus));
      } else {
        dispatch(setUserStatus(null));
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to update status";
      setError(errorMessage);
      log.error("Failed to update status", err, {
        statusType: selectedType,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isLoading = !currentStatus && isUpdating;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <div className="grid gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-heading-2 leading-heading-2">
          {t("component.statusSelector.title")}
        </CardTitle>
        <CardDescription className="text-body leading-body">
          {t("component.statusSelector.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label className="text-body leading-body">
            {t("component.statusSelector.status")}
          </Label>
          <div className="grid gap-3">
            {STATUS_OPTIONS.map((option) => {
              const isSelected = selectedType === option.type;
              const variantClass = isSelected
                ? option.type === "safe"
                  ? "bg-safety text-white hover:bg-safety/90"
                  : option.type === "need_help"
                    ? "bg-warning text-white hover:bg-warning/90"
                    : "bg-sos text-white hover:bg-sos/90"
                : "outline";

              return (
                <Button
                  key={option.type}
                  variant={variantClass === "outline" ? "outline" : "default"}
                  className={cn(
                    "justify-start h-12",
                    variantClass !== "outline" && variantClass
                  )}
                  onClick={() => handleStatusSelect(option.type)}
                  isDisabled={isUpdating}
                >
                  <span
                    className={cn(
                      "mr-2",
                      isSelected ? "text-white" : option.color
                    )}
                  >
                    {option.icon}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-body leading-body">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "text-caption leading-caption",
                        isSelected ? "opacity-90" : "opacity-70"
                      )}
                    >
                      {option.description}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-description">
            {t("component.statusSelector.descriptionLabel")}
          </Label>
          <Textarea
            id="status-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("component.statusSelector.descriptionPlaceholder")}
            maxLength={200}
            isDisabled={isUpdating}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {t("component.statusSelector.charactersRemaining", {
              count: description.length,
            })}
          </p>
        </div>

        <Button
          onClick={handleUpdate}
          isDisabled={!selectedType || isUpdating}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t("component.statusSelector.updating")}
            </>
          ) : (
            t("component.statusSelector.updateStatus")
          )}
        </Button>

        {currentStatus && (
          <p className="text-caption leading-caption text-center text-muted-foreground">
            {t("component.statusSelector.lastUpdated", {
              date: new Date(currentStatus.updated_at).toLocaleString(),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
