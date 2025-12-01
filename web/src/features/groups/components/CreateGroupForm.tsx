/**
 * Create Group Form Component
 * Form for creating a new community group
 */

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useDispatch, useSelector } from "react-redux";
import { MapPin, Loader2 } from "lucide-react";
import type { Group } from "@/shared/domain/group";
import {
  createGroupAction,
  suggestGroupAction,
} from "@/features/groups/store/groupSaga";
import { selectDeviceLocation } from "@/features/navigation/store/appSlice";
import {
  selectGroupSuggestion,
  selectGroupSuggestionLoading,
  selectGroupSuggestionError,
} from "@/features/groups/store/slice";
import type { RootState } from "@/store";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import {
  createGroupSchema,
  type CreateGroupFormData,
} from "../schemas/group-form.schema";

export interface CreateGroupFormProps {
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Custom className */
  className?: string;
}

const getGroupTypes = (): Array<{ value: Group["type"]; label: string }> => [
  // Cấp nhỏ nhất - đặt lên đầu
  { value: "village", label: t("group.type.village") },
  { value: "hamlet", label: t("group.type.hamlet") },
  { value: "residential_group", label: t("group.type.residential_group") },
  { value: "street_block", label: t("group.type.street_block") },
  // Cấp xã/phường
  { value: "ward", label: t("group.type.ward") },
  { value: "commune", label: t("group.type.commune") },
  // Khu vực đặc biệt
  { value: "apartment", label: t("group.type.apartment") },
  { value: "residential_area", label: t("group.type.residential_area") },
  // Khác
  { value: "other", label: t("group.type.other") },
];

/**
 * Create Group Form component
 * Allows users to create a new group with location-based suggestions
 */
export function CreateGroupForm({
  onCancel,
  className = "",
}: CreateGroupFormProps) {
  const dispatch = useDispatch();
  const deviceLocation = useSelector((state: RootState) =>
    selectDeviceLocation(state)
  );
  const groupSuggestion = useSelector((state: RootState) =>
    selectGroupSuggestion(state)
  );
  const groupSuggestionLoading = useSelector((state: RootState) =>
    selectGroupSuggestionLoading(state)
  );
  const groupSuggestionError = useSelector((state: RootState) =>
    selectGroupSuggestionError(state)
  );

  const GROUP_TYPES = getGroupTypes();

  // Form state managed by react-hook-form
  const form = useForm<CreateGroupFormData>({
    resolver: standardSchemaResolver(createGroupSchema),
    defaultValues: {
      name: "",
      type: "village",
      latitude: 0,
      longitude: 0,
    },
    mode: "onSubmit",
  });

  // UI-only state for manual location inputs (strings for display)
  const [manualLocation, setManualLocation] = useState({ lat: "", lon: "" });
  const isLoading = form.formState.isSubmitting;

  // Sync Redux state (deviceLocation) to form
  useEffect(() => {
    if (deviceLocation) {
      form.reset({
        name: form.getValues("name") || "",
        type: form.getValues("type") || "village",
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
      });
      setManualLocation({
        lat: deviceLocation.latitude.toFixed(6),
        lon: deviceLocation.longitude.toFixed(6),
      });
      // Load suggestions via Redux action
      dispatch(
        suggestGroupAction(deviceLocation.latitude, deviceLocation.longitude)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceLocation?.latitude, deviceLocation?.longitude, dispatch]);

  // Update name and type when suggestion is available
  useEffect(() => {
    if (groupSuggestion) {
      form.setValue("name", groupSuggestion.suggested_name);
      form.setValue("type", groupSuggestion.suggested_type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSuggestion?.suggested_name, groupSuggestion?.suggested_type]);

  const handleManualLocationChange = () => {
    const lat = parseFloat(manualLocation.lat);
    const lon = parseFloat(manualLocation.lon);

    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      // Update form values (will trigger validation)
      form.setValue("latitude", lat);
      form.setValue("longitude", lon);
      form.trigger(["latitude", "longitude"]);
      // Load suggestions via Redux action
      dispatch(suggestGroupAction(lat, lon));
    }
  };

  const onSubmit = (data: CreateGroupFormData) => {
    // Dispatch action to create group (saga will handle service call)
    dispatch(
      createGroupAction({
        name: data.name.trim(),
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
      })
    );
    // Note: Group creation is handled by saga
    // The created group will be available in Redux store via Groups RxDB listener
    // Parent component can listen to Redux state changes to detect new group
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={cn("space-y-4", className)}
    >
      {(groupSuggestionError ||
        form.formState.errors.root ||
        Object.keys(form.formState.errors).length > 0) && (
        <Alert variant="destructive">
          <AlertDescription>
            {groupSuggestionError ||
              form.formState.errors.root?.message ||
              Object.values(form.formState.errors)[0]?.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="group-type">
          {t("component.createGroupForm.groupType")}
        </Label>
        <Controller
          name="type"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isLoading || groupSuggestionLoading}
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
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-name">
          {t("component.createGroupForm.groupName")}
        </Label>
        <Input
          id="group-name"
          {...form.register("name")}
          placeholder={t("component.createGroupForm.groupNamePlaceholder")}
          required
          maxLength={100}
          disabled={isLoading || groupSuggestionLoading}
          aria-invalid={!!form.formState.errors.name}
          aria-describedby={
            form.formState.errors.name ? "group-name-error" : undefined
          }
        />
        {form.formState.errors.name && (
          <p
            id="group-name-error"
            className="text-caption leading-caption text-destructive"
          >
            {form.formState.errors.name.message}
          </p>
        )}
        {groupSuggestionLoading && !form.formState.errors.name && (
          <p className="text-caption leading-caption text-muted-foreground flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            {t("component.createGroupForm.loadingSuggestions")}
          </p>
        )}
        {!form.formState.errors.name && !groupSuggestionLoading && (
          <p className="text-caption leading-caption text-muted-foreground">
            {t("component.createGroupForm.charactersRemaining", {
              count: 100 - (form.watch("name")?.length || 0),
            })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("component.createGroupForm.location")}</Label>
        {form.watch("latitude") && form.watch("longitude") ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-body leading-body text-muted-foreground">
              <MapPin className="size-4" />
              <span>
                {form.watch("latitude")?.toFixed(6)},{" "}
                {form.watch("longitude")?.toFixed(6)}
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
                  }}
                  onBlur={handleManualLocationChange}
                  placeholder={t(
                    "component.createGroupForm.latitudePlaceholder"
                  )}
                  min={-90}
                  max={90}
                  aria-invalid={!!form.formState.errors.latitude}
                  aria-describedby={
                    form.formState.errors.latitude
                      ? "manual-lat-error"
                      : undefined
                  }
                />
                {form.formState.errors.latitude && (
                  <p
                    id="manual-lat-error"
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {form.formState.errors.latitude.message}
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
                  }}
                  onBlur={handleManualLocationChange}
                  placeholder={t(
                    "component.createGroupForm.longitudePlaceholder"
                  )}
                  min={-180}
                  max={180}
                  aria-invalid={!!form.formState.errors.longitude}
                  aria-describedby={
                    form.formState.errors.longitude
                      ? "manual-lon-error"
                      : undefined
                  }
                />
                {form.formState.errors.longitude && (
                  <p
                    id="manual-lon-error"
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {form.formState.errors.longitude.message}
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
                  aria-invalid={!!form.formState.errors.latitude}
                  aria-describedby={
                    form.formState.errors.latitude
                      ? "manual-lat-error-required"
                      : undefined
                  }
                />
                {form.formState.errors.latitude && (
                  <p
                    id="manual-lat-error-required"
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {form.formState.errors.latitude.message}
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
                  aria-invalid={!!form.formState.errors.longitude}
                  aria-describedby={
                    form.formState.errors.longitude
                      ? "manual-lon-error-required"
                      : undefined
                  }
                />
                {form.formState.errors.longitude && (
                  <p
                    id="manual-lon-error-required"
                    className="text-caption leading-caption text-destructive mt-1"
                  >
                    {form.formState.errors.longitude.message}
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
          isDisabled={
            isLoading ||
            !form.watch("latitude") ||
            !form.watch("longitude") ||
            !form.formState.isValid
          }
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
