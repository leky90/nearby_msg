/**
 * Status View - Account Screen
 * Displays user nickname (editable) and location (editable)
 */

import { NicknameSection } from "./NicknameSection";
import { LocationSection } from "./LocationSection";

export function StatusView() {
  return (
    <div className="h-full w-full overflow-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center px-4 py-3">
          <h1 className="text-lg font-semibold">Tài khoản</h1>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* User Nickname Section */}
        <NicknameSection />

        {/* Divider */}
        <div className="border-t" />

        {/* Location Section */}
        <LocationSection />
      </div>
    </div>
  );
}
