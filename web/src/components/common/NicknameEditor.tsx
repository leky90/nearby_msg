/**
 * Nickname Editor Component
 * Allows users to edit their nickname
 */

import { useState, useEffect } from "react";
import { User, Loader2 } from "lucide-react";
import { updateNickname, getDevice } from "../../services/device-service";
import { getOrCreateDeviceId } from "../../services/device-storage";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";

export interface NicknameEditorProps {
  /** Callback when nickname is updated */
  onNicknameUpdated?: (nickname: string) => void;
  /** Custom className */
  className?: string;
}

const MAX_NICKNAME_LENGTH = 50;
const MIN_NICKNAME_LENGTH = 1;

/**
 * Nickname Editor component
 * Allows users to edit their nickname
 */
export function NicknameEditor({
  onNicknameUpdated,
  className = "",
}: NicknameEditorProps) {
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current nickname on mount
  useEffect(() => {
    const loadNickname = async () => {
      setIsLoadingCurrent(true);
      try {
        const device = await getDevice();
        if (device) {
          setNickname(device.nickname || "");
        } else {
          // Fallback: use device ID as default
          const deviceId = getOrCreateDeviceId();
          setNickname(`User ${deviceId.slice(0, 8)}`);
        }
      } catch (err) {
        console.error("Failed to load nickname:", err);
        const deviceId = getOrCreateDeviceId();
        setNickname(`User ${deviceId.slice(0, 8)}`);
      } finally {
        setIsLoadingCurrent(false);
      }
    };

    void loadNickname();
  }, []);

  const handleUpdate = async () => {
    const trimmed = nickname.trim();

    if (trimmed.length < MIN_NICKNAME_LENGTH) {
      setError(`Nickname must be at least ${MIN_NICKNAME_LENGTH} character`);
      return;
    }

    if (trimmed.length > MAX_NICKNAME_LENGTH) {
      setError(`Nickname must be at most ${MAX_NICKNAME_LENGTH} characters`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateNickname(trimmed);
      onNicknameUpdated?.(trimmed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update nickname"
      );
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

  const remainingChars = MAX_NICKNAME_LENGTH - nickname.length;
  const canUpdate =
    nickname.trim().length >= MIN_NICKNAME_LENGTH &&
    nickname.length <= MAX_NICKNAME_LENGTH;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5" />
          Edit Nickname
        </CardTitle>
        <CardDescription>
          Choose a nickname to display in groups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            maxLength={MAX_NICKNAME_LENGTH}
            isDisabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canUpdate && !isLoading) {
                void handleUpdate();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {remainingChars} characters remaining
            </p>
            {!canUpdate && nickname.trim().length > 0 && (
              <p className="text-xs text-destructive">
                Nickname must be {MIN_NICKNAME_LENGTH}-{MAX_NICKNAME_LENGTH}{" "}
                characters
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={handleUpdate}
          isDisabled={!canUpdate || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Nickname"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
