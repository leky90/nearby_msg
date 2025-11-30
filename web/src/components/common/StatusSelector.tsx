/**
 * Status Selector Component
 * Allows users to select and update their safety status
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import type { StatusType, UserStatus } from "../../domain/user_status";
import {
  updateStatusMutation,
  fetchStatus,
} from "../../services/status-service";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { Button } from "../ui/button";
import { log } from "../../lib/logging/logger";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

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
  const queryClient = useQueryClient();
  const deviceId = getOrCreateDeviceId();
  const [selectedType, setSelectedType] = useState<StatusType | null>(null);
  const [description, setDescription] = useState("");
  const STATUS_OPTIONS = getStatusOptions();

  // Load current status using TanStack Query
  const { data: currentStatus, isLoading: isLoadingCurrent } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  // Initialize form when status loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentStatus) {
      setSelectedType(currentStatus.status_type);
      setDescription(currentStatus.description || "");
    }
    // Only run when currentStatus changes, not on every render
  }, [currentStatus]);

  // Mutation for updating status with optimistic updates
  const updateMutation = useMutation({
    mutationFn: updateStatusMutation,
    // Optimistic update: immediately update UI before server responds
    onMutate: async (variables) => {
      // Cancel outgoing queries to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["status"] });

      // Snapshot previous value for rollback
      const previousStatus = queryClient.getQueryData<UserStatus | null>([
        "status",
      ]);

      // Optimistically update cache
      const optimisticStatus: UserStatus = {
        id: previousStatus?.id || "",
        device_id: deviceId,
        status_type: variables.statusType,
        description: variables.description || undefined,
        created_at: previousStatus?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData(["status"], optimisticStatus);

      return { previousStatus };
    },
    // On success, update with server response and invalidate related queries
    onSuccess: (data) => {
      queryClient.setQueryData(["status"], data);
      queryClient.invalidateQueries({ queryKey: ["status"] });
      onStatusUpdated?.(data);
    },
    // On error, rollback to previous value
    onError: (err, variables, context) => {
      if (context?.previousStatus !== undefined) {
        queryClient.setQueryData(["status"], context.previousStatus);
      }
      log.error("Failed to update status", err, {
        statusType: variables.statusType,
      });
    },
  });

  const handleStatusSelect = (type: StatusType) => {
    setSelectedType(type);
  };

  const handleUpdate = async () => {
    if (!selectedType) {
      return;
    }

    updateMutation.mutate({
      statusType: selectedType,
      description: description.trim() || undefined,
    });
  };

  const isLoading = updateMutation.isPending;
  const error =
    updateMutation.error instanceof Error ? updateMutation.error.message : null;

  if (isLoadingCurrent) {
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
                  isDisabled={isLoading}
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
            isDisabled={isLoading}
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
          isDisabled={!selectedType || isLoading}
          className="w-full"
        >
          {isLoading ? (
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
