/**
 * Status Selector Component
 * Allows users to select and update their safety status
 */

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import type { StatusType, UserStatus } from "../../domain/user_status";
import { updateStatus, getStatus } from "../../services/status-service";
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
  const [currentStatus, setCurrentStatus] = useState<UserStatus | null>(null);
  const [selectedType, setSelectedType] = useState<StatusType | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current status on mount
  useEffect(() => {
    const loadStatus = async () => {
      setIsLoadingCurrent(true);
      try {
        const status = await getStatus();
        if (status) {
          setCurrentStatus(status);
          setSelectedType(status.status_type);
          setDescription(status.description || "");
        }
      } catch (err) {
        console.error("Failed to load status:", err);
      } finally {
        setIsLoadingCurrent(false);
      }
    };

    void loadStatus();
  }, []);

  const handleStatusSelect = (type: StatusType) => {
    setSelectedType(type);
    setError(null);
  };

  const handleUpdate = async () => {
    if (!selectedType) {
      setError("Please select a status");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updated = await updateStatus(
        selectedType,
        description.trim() || undefined
      );
      setCurrentStatus(updated);
      onStatusUpdated?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

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
