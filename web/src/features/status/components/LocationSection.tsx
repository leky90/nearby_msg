/**
 * Location Section Component
 * GPS location input and display
 */

import { LocationInput } from "@/shared/components/LocationInput";
import { useLocationInput } from "@/shared/hooks/useLocationInput";

export function LocationSection() {
  // useLocationInput already syncs with app store automatically
  const locationInput = useLocationInput();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/70">
        Vị trí GPS
      </label>

      <LocationInput
        locationInput={locationInput}
        showInstructions={true}
        disabled={false}
      />
    </div>
  );
}
