/**
 * Status Selector Component
 * Allows users to select and update their safety status
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import type { StatusType, UserStatus } from "../../domain/user_status";
import { updateStatusMutation, fetchStatus, getStatus } from "../../services/status-service";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { Button } from "../ui/button";
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
import { cn } from "@/lib/utils";

export interface StatusSelectorProps {
  /** Callback when status is updated */
  onStatusUpdated?: (status: UserStatus) => void;
  /** Custom className */
  className?: string;
}

const STATUS_OPTIONS: Array<{
  type: StatusType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = [
  {
    type: "safe",
    label: "Safe",
    icon: <CheckCircle2 className="size-5" />,
    color: "text-green-600",
    description: "I am safe and okay",
  },
  {
    type: "need_help",
    label: "Need Help",
    icon: <AlertCircle className="size-5" />,
    color: "text-yellow-600",
    description: "I need assistance",
  },
  {
    type: "cannot_contact",
    label: "Cannot Contact",
    icon: <XCircle className="size-5" />,
    color: "text-red-600",
    description: "I cannot be contacted",
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

  // Load current status using TanStack Query
  const { data: currentStatus, isLoading: isLoadingCurrent } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  // Initialize form when status loads
  useEffect(() => {
    if (currentStatus) {
      setSelectedType(currentStatus.status_type);
      setDescription(currentStatus.description || "");
    }
  }, [currentStatus]);

  // Mutation for updating status with optimistic updates
  const updateMutation = useMutation({
    mutationFn: updateStatusMutation,
    // Optimistic update: immediately update UI before server responds
    onMutate: async (variables) => {
      // Cancel outgoing queries to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['status'] });

      // Snapshot previous value for rollback
      const previousStatus = queryClient.getQueryData<UserStatus | null>(['status']);

      // Optimistically update cache
      const optimisticStatus: UserStatus = {
        id: previousStatus?.id || '',
        device_id: deviceId,
        status_type: variables.statusType,
        description: variables.description || null,
        created_at: previousStatus?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData(['status'], optimisticStatus);

      return { previousStatus };
    },
    // On success, update with server response and invalidate related queries
    onSuccess: (data) => {
      queryClient.setQueryData(['status'], data);
      queryClient.invalidateQueries({ queryKey: ['status'] });
      onStatusUpdated?.(data);
    },
    // On error, rollback to previous value
    onError: (err, _variables, context) => {
      if (context?.previousStatus !== undefined) {
        queryClient.setQueryData(['status'], context.previousStatus);
      }
      console.error('Failed to update status:', err);
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
  const error = updateMutation.error instanceof Error ? updateMutation.error.message : null;

  if (isLoadingCurrent) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Update Safety Status</CardTitle>
        <CardDescription>
          Let others know your current safety status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Status</Label>
          <div className="grid gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.type}
                variant={selectedType === option.type ? "default" : "outline"}
                className={cn(
                  "justify-start",
                  selectedType === option.type && option.color
                )}
                onClick={() => handleStatusSelect(option.type)}
                isDisabled={isLoading}
              >
                <span className={cn("mr-2", option.color)}>{option.icon}</span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs opacity-70">
                    {option.description}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-description">Description (Optional)</Label>
          <Textarea
            id="status-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any additional details..."
            maxLength={200}
            isDisabled={isLoading}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/200 characters
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
              Updating...
            </>
          ) : (
            "Update Status"
          )}
        </Button>

        {currentStatus && (
          <p className="text-xs text-center text-muted-foreground">
            Last updated: {new Date(currentStatus.updated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
