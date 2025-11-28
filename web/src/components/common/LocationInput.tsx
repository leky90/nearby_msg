/**
 * Location Input Component
 * Reusable component for GPS location input with Google Maps URL fallback
 */

import { MapPin, Loader2, Link, Copy, Check, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GoogleMapsInstructionsModal } from "./GoogleMapsInstructionsModal";
import { useAppStore } from "@/stores/app-store";
import { copyCoordinates } from "@/utils/copy-coordinates";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { UseLocationInputReturn } from "@/hooks/useLocationInput";

export interface LocationInputProps {
  /** Location input hook return value */
  locationInput: UseLocationInputReturn;
  /** Whether to show instructions */
  showInstructions?: boolean;
  /** Custom label */
  label?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

function LocationAddressDisplay({
  location: _location,
}: {
  location: { latitude: number; longitude: number };
}) {
  const { deviceLocation } = useAppStore();

  if (deviceLocation?.address) {
    return (
      <p className="text-xs text-foreground/80 font-medium mt-0.5">
        {deviceLocation.address}
      </p>
    );
  }
  return null;
}

function CopyCoordinatesButton({
  location,
}: {
  location: { latitude: number; longitude: number };
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyCoordinates(location.latitude, location.longitude);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onPress={handleCopy}
      className="h-7 w-7 p-0 shrink-0"
      aria-label="Copy tọa độ"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-safety" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      )}
    </Button>
  );
}

export function LocationInput({
  locationInput,
  showInstructions = false,
  label = "Link Google Maps hoặc tọa độ (lat,lng)",
  disabled = false,
  className,
}: LocationInputProps) {
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const {
    location,
    isLoadingLocation,
    showManualInput,
    googleMapsUrl,
    isParsingUrl,
    locationError,
    handleRequestGPS,
    handleGoogleMapsUrlChange,
    handleParseGoogleMapsUrl,
    handleShowManualInput,
  } = locationInput;

  const handleResetLocation = () => {
    locationInput.reset();
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Show form only when no location is set or when manually inputting */}
      {!location && (
        <>
          {!showManualInput && (
            <div className="flex gap-2">
              <Button
                type="button"
                onPress={handleRequestGPS}
                isDisabled={isLoadingLocation || disabled}
                variant="outline"
                className="flex-1"
              >
                {isLoadingLocation ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Đang lấy...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Lấy vị trí từ GPS
                  </>
                )}
              </Button>
              <Button
                type="button"
                onPress={handleShowManualInput}
                isDisabled={disabled}
                variant="outline"
                className="flex-1"
              >
                <Link className="h-4 w-4 mr-2" />
                Nhập thủ công
              </Button>
            </div>
          )}

          {showManualInput && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="google-maps-url">{label}</Label>
                {showInstructions && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInstructionsModal(true)}
                    className="h-7 px-2 text-xs"
                  >
                    <HelpCircle className="h-3.5 w-3.5 mr-1" />
                    Hướng dẫn
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="google-maps-url"
                  value={googleMapsUrl}
                  onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
                  placeholder="https://maps.google.com/?q=10.762622,106.660172 hoặc 10.762622,106.660172"
                  disabled={isParsingUrl || disabled}
                  className={cn(
                    "flex-1",
                    locationError && "border-destructive"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleParseGoogleMapsUrl();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleParseGoogleMapsUrl}
                  isDisabled={isParsingUrl || !googleMapsUrl.trim() || disabled}
                  className="shrink-0"
                >
                  {isParsingUrl ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Lấy tọa độ
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dán link Google Maps hoặc nhập tọa độ dạng lat,lng (ví dụ:
                10.762622,106.660172)
              </p>
              {location && (
                <div className="flex items-center gap-2 text-sm text-safety">
                  <MapPin className="h-4 w-4" />
                  <span>
                    Đã lấy tọa độ:{" "}
                    {(
                      location as { latitude: number; longitude: number }
                    ).latitude.toFixed(6)}
                    ,{" "}
                    {(
                      location as { latitude: number; longitude: number }
                    ).longitude.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <GoogleMapsInstructionsModal
          open={showInstructionsModal}
          onOpenChange={setShowInstructionsModal}
        />
      )}

      {/* Show location info and reset button when location is set */}
      {location && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-safety/10 border border-safety/20 rounded-lg">
            <MapPin className="h-4 w-4 text-safety shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-safety">Vị trí hiện tại</p>
              <LocationAddressDisplay location={location} />
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">
                  {location.latitude.toFixed(10)},{" "}
                  {location.longitude.toFixed(10)}
                </p>
                <CopyCoordinatesButton location={location} />
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={handleResetLocation}
            isDisabled={disabled}
            className="w-full"
          >
            <MapPin className="h-3 w-3 mr-1" />
            Nhập lại GPS
          </Button>
        </div>
      )}

      {!showManualInput && !location && isLoadingLocation && (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Đang lấy vị trí từ GPS...
          </span>
        </div>
      )}

      {locationError && (
        <p className="text-xs text-destructive">{locationError}</p>
      )}
    </div>
  );
}
