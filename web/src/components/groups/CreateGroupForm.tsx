/**
 * Create Group Form Component
 * Form for creating a new community group
 */

import { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import type { Group } from "../../domain/group";
import {
  createGroup,
  suggestGroupNameAndType,
} from "../../services/group-service";
import { getCurrentLocation } from "../../services/location-service";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Alert, AlertDescription } from "../ui/alert";
import { cn } from "@/lib/utils";

export interface CreateGroupFormProps {
  /** Callback when group is created */
  onGroupCreated?: (group: Group) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Custom className */
  className?: string;
}

const GROUP_TYPES: Array<{ value: Group["type"]; label: string }> = [
  { value: "neighborhood", label: "Neighborhood" },
  { value: "ward", label: "Ward" },
  { value: "district", label: "District" },
  { value: "apartment", label: "Apartment" },
  { value: "other", label: "Other" },
];

/**
 * Create Group Form component
 * Allows users to create a new group with location-based suggestions
 */
export function CreateGroupForm({
  onGroupCreated,
  onCancel,
  className = "",
}: CreateGroupFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Group["type"]>("neighborhood");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    latitude?: string;
    longitude?: string;
  }>({});
  const [manualLocation, setManualLocation] = useState({ lat: "", lon: "" });

  // Load current location on mount
  useEffect(() => {
    const loadLocation = async () => {
      setIsLoadingLocation(true);
      try {
        const location = await getCurrentLocation();
        if (location) {
          setLatitude(location.latitude);
          setLongitude(location.longitude);
          setManualLocation({
            lat: location.latitude.toFixed(6),
            lon: location.longitude.toFixed(6),
          });
          // Load suggestions
          await loadSuggestions(location.latitude, location.longitude);
        }
      } catch (err) {
        console.error("Failed to get location:", err);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    void loadLocation();
  }, []);

  const loadSuggestions = async (lat: number, lon: number) => {
    setIsLoadingSuggestion(true);
    try {
      const suggestion = await suggestGroupNameAndType(lat, lon);
      setName(suggestion.suggested_name);
      setType(suggestion.suggested_type);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleManualLocationChange = () => {
    const lat = parseFloat(manualLocation.lat);
    const lon = parseFloat(manualLocation.lon);
    const errors: typeof fieldErrors = {};

    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = "Latitude must be between -90 and 90";
    } else {
      delete errors.latitude;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.longitude = "Longitude must be between -180 and 180";
    } else {
      delete errors.longitude;
    }

    setFieldErrors(errors);

    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      setLatitude(lat);
      setLongitude(lon);
      void loadSuggestions(lat, lon);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors: typeof fieldErrors = {};

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = "Group name is required";
    } else if (trimmedName.length > 100) {
      errors.name = "Group name must be 100 characters or less";
    } else {
      delete errors.name;
    }

    // Validate location
    if (!latitude || !longitude) {
      errors.latitude = "Location is required";
      errors.longitude = "Location is required";
    } else {
      delete errors.latitude;
      delete errors.longitude;
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsLoading(true);
    try {
      if (!latitude || !longitude) {
        throw new Error("Location is required");
      }
      const group = await createGroup({
        name: name.trim(),
        type,
        latitude,
        longitude,
      });
      onGroupCreated?.(group);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create group";
      // Check if it's the "already created group" error
      if (
        errorMessage.includes("already created") ||
        errorMessage.includes("409")
      ) {
        setError(
          "You have already created a group. Each device can only create one group."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="group-name">Group Name</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) {
              setFieldErrors({ ...fieldErrors, name: undefined });
            }
          }}
          placeholder="Enter group name"
          required
          maxLength={100}
          isDisabled={isLoading || isLoadingSuggestion}
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "group-name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="group-name-error" className="text-xs text-destructive">
            {fieldErrors.name}
          </p>
        )}
        {isLoadingSuggestion && !fieldErrors.name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            Loading suggestions...
          </p>
        )}
        {!fieldErrors.name && !isLoadingSuggestion && (
          <p className="text-xs text-muted-foreground">
            {100 - name.length} characters remaining
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-type">Group Type</Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value as Group["type"])}
          isDisabled={isLoading || isLoadingSuggestion}
        >
          <SelectTrigger id="group-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_TYPES.map((gt) => (
              <SelectItem key={gt.value} value={gt.value}>
                {gt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Location</Label>
        {isLoadingLocation ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Getting your location...</span>
          </div>
        ) : latitude && longitude ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              <span>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="manual-lat" className="text-xs">
                  Latitude
                </Label>
                <Input
                  id="manual-lat"
                  type="number"
                  step="any"
                  value={manualLocation.lat}
                  onChange={(e) => {
                    setManualLocation({
                      ...manualLocation,
                      lat: e.target.value,
                    });
                    if (fieldErrors.latitude) {
                      setFieldErrors({ ...fieldErrors, latitude: undefined });
                    }
                  }}
                  onBlur={handleManualLocationChange}
                  placeholder="-90 to 90"
                  min={-90}
                  max={90}
                  aria-invalid={!!fieldErrors.latitude}
                  aria-describedby={
                    fieldErrors.latitude ? "manual-lat-error" : undefined
                  }
                />
                {fieldErrors.latitude && (
                  <p
                    id="manual-lat-error"
                    className="text-xs text-destructive mt-1"
                  >
                    {fieldErrors.latitude}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="manual-lon" className="text-xs">
                  Longitude
                </Label>
                <Input
                  id="manual-lon"
                  type="number"
                  step="any"
                  value={manualLocation.lon}
                  onChange={(e) => {
                    setManualLocation({
                      ...manualLocation,
                      lon: e.target.value,
                    });
                    if (fieldErrors.longitude) {
                      setFieldErrors({ ...fieldErrors, longitude: undefined });
                    }
                  }}
                  onBlur={handleManualLocationChange}
                  placeholder="-180 to 180"
                  min={-180}
                  max={180}
                  aria-invalid={!!fieldErrors.longitude}
                  aria-describedby={
                    fieldErrors.longitude ? "manual-lon-error" : undefined
                  }
                />
                {fieldErrors.longitude && (
                  <p
                    id="manual-lon-error"
                    className="text-xs text-destructive mt-1"
                  >
                    {fieldErrors.longitude}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Location not available. Please enter coordinates manually.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="manual-lat" className="text-xs">
                  Latitude
                </Label>
                <Input
                  id="manual-lat"
                  type="number"
                  step="any"
                  value={manualLocation.lat}
                  onChange={(e) =>
                    setManualLocation({
                      ...manualLocation,
                      lat: e.target.value,
                    })
                  }
                  onBlur={handleManualLocationChange}
                  placeholder="-90 to 90"
                  min={-90}
                  max={90}
                  required
                  aria-invalid={!!fieldErrors.latitude}
                  aria-describedby={
                    fieldErrors.latitude
                      ? "manual-lat-error-required"
                      : undefined
                  }
                />
                {fieldErrors.latitude && (
                  <p
                    id="manual-lat-error-required"
                    className="text-xs text-destructive mt-1"
                  >
                    {fieldErrors.latitude}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="manual-lon" className="text-xs">
                  Longitude
                </Label>
                <Input
                  id="manual-lon"
                  type="number"
                  step="any"
                  value={manualLocation.lon}
                  onChange={(e) =>
                    setManualLocation({
                      ...manualLocation,
                      lon: e.target.value,
                    })
                  }
                  onBlur={handleManualLocationChange}
                  placeholder="-180 to 180"
                  min={-180}
                  max={180}
                  required
                  aria-invalid={!!fieldErrors.longitude}
                  aria-describedby={
                    fieldErrors.longitude
                      ? "manual-lon-error-required"
                      : undefined
                  }
                />
                {fieldErrors.longitude && (
                  <p
                    id="manual-lon-error-required"
                    className="text-xs text-destructive mt-1"
                  >
                    {fieldErrors.longitude}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" isDisabled={isLoading || !latitude || !longitude}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Group"
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
