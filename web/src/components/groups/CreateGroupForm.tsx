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
import { t } from "@/lib/i18n";

export interface CreateGroupFormProps {
  /** Callback when group is created */
  onGroupCreated?: (group: Group) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Custom className */
  className?: string;
}

const getGroupTypes = (): Array<{ value: Group["type"]; label: string }> => [
  { value: "neighborhood", label: t("group.type.neighborhood") },
  { value: "ward", label: t("group.type.ward") },
  { value: "district", label: t("group.type.district") },
  { value: "apartment", label: t("group.type.apartment") },
  { value: "other", label: t("group.type.other") },
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
  const GROUP_TYPES = getGroupTypes();
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
      errors.latitude = t("component.createGroupForm.latitudeInvalid");
    } else {
      delete errors.latitude;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.longitude = t("component.createGroupForm.longitudeInvalid");
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
      errors.name = t("component.createGroupForm.groupNameRequired");
    } else if (trimmedName.length > 100) {
      errors.name = t("component.createGroupForm.groupNameTooLong");
    } else {
      delete errors.name;
    }

    // Validate location
    if (!latitude || !longitude) {
      errors.latitude = t("component.createGroupForm.locationRequired");
      errors.longitude = t("component.createGroupForm.locationRequired");
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
        setError(t("component.createGroupForm.alreadyCreatedGroup"));
      } else {
        setError(t("component.createGroupForm.failedToCreate"));
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
        <Label htmlFor="group-name">
          {t("component.createGroupForm.groupName")}
        </Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) {
              setFieldErrors({ ...fieldErrors, name: undefined });
            }
          }}
          placeholder={t("component.createGroupForm.groupNamePlaceholder")}
          required
          maxLength={100}
          disabled={isLoading || isLoadingSuggestion}
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "group-name-error" : undefined}
        />
        {fieldErrors.name && (
          <p
            id="group-name-error"
            className="text-caption leading-caption text-destructive"
          >
            {fieldErrors.name}
          </p>
        )}
        {isLoadingSuggestion && !fieldErrors.name && (
          <p className="text-caption leading-caption text-muted-foreground flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            {t("component.createGroupForm.loadingSuggestions")}
          </p>
        )}
        {!fieldErrors.name && !isLoadingSuggestion && (
          <p className="text-caption leading-caption text-muted-foreground">
            {t("component.createGroupForm.charactersRemaining", {
              count: 100 - name.length,
            })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-type">
          {t("component.createGroupForm.groupType")}
        </Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value as Group["type"])}
          disabled={isLoading || isLoadingSuggestion}
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
        <Label>{t("component.createGroupForm.location")}</Label>
        {isLoadingLocation ? (
          <div className="flex items-center gap-2 text-body leading-body text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>{t("component.createGroupForm.gettingLocation")}</span>
          </div>
        ) : latitude && longitude ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-body leading-body text-muted-foreground">
              <MapPin className="size-4" />
              <span>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label
                  htmlFor="manual-lat"
                  className="text-caption leading-caption"
                >
                  {t("component.createGroupForm.latitude")}
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
                  placeholder={t(
                    "component.createGroupForm.latitudePlaceholder"
                  )}
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
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {fieldErrors.latitude}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="manual-lon"
                  className="text-caption leading-caption"
                >
                  {t("component.createGroupForm.longitude")}
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
                  placeholder={t(
                    "component.createGroupForm.longitudePlaceholder"
                  )}
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
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {fieldErrors.longitude}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-body leading-body text-muted-foreground">
              {t("component.createGroupForm.locationNotAvailable")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label
                  htmlFor="manual-lat"
                  className="text-caption leading-caption"
                >
                  {t("component.createGroupForm.latitude")}
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
                  placeholder={t(
                    "component.createGroupForm.latitudePlaceholder"
                  )}
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
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {fieldErrors.latitude}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="manual-lon"
                  className="text-caption leading-caption"
                >
                  {t("component.createGroupForm.longitude")}
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
                  placeholder={t(
                    "component.createGroupForm.longitudePlaceholder"
                  )}
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
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {fieldErrors.longitude}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          isDisabled={isLoading || !latitude || !longitude}
          className="h-12"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t("component.createGroupForm.creating")}
            </>
          ) : (
            t("component.createGroupForm.createGroup")
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-12"
          >
            {t("button.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
