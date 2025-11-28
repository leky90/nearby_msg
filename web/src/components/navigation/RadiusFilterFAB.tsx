import { useState } from "react";
import { MapPin, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { RadiusOption } from "@/domain/group";

interface RadiusFilterFABProps {
  selectedRadius: RadiusOption;
  onRadiusChange: (radius: RadiusOption) => void;
}

const radiusOptions: { value: RadiusOption; label: string }[] = [
  { value: 2000, label: "< 2km" },
  { value: 1000, label: "< 1km" },
  { value: 500, label: "< 500m" },
];

export function RadiusFilterFAB({
  selectedRadius,
  onRadiusChange,
}: RadiusFilterFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel =
    radiusOptions.find((opt) => opt.value === selectedRadius)?.label || "";

  return (
    <div
      className={cn(
        "fixed right-4 z-40",
        "bottom-[calc(4rem+1rem+env(safe-area-inset-bottom,0px))]",
        "transition-all duration-200"
      )}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "w-14 h-14 rounded-full",
              "bg-info text-white",
              "shadow-lg hover:shadow-xl",
              "flex items-center justify-center",
              "transition-all duration-200",
              "active:scale-95",
              "hover:scale-105",
              "ring-2 ring-info/30",
              isOpen && "ring-4 ring-info/50 scale-105"
            )}
            aria-label="Lọc theo khoảng cách"
          >
            <MapPin className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={8}
          className="min-w-[140px]"
        >
          {radiusOptions.map((option) => {
            const isSelected = selectedRadius === option.value;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                  onRadiusChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between cursor-pointer",
                  "px-3 py-2.5",
                  isSelected && "bg-info/10 text-info font-medium"
                )}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-info ml-2" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Badge showing selected radius */}
      {!isOpen && (
        <div
          className={cn(
            "absolute -top-1 -right-1",
            "bg-info text-white",
            "text-[10px] font-semibold",
            "px-1.5 py-0.5 rounded-full",
            "ring-2 ring-background shadow-md",
            "min-w-[32px] text-center"
          )}
        >
          {selectedLabel}
        </div>
      )}
    </div>
  );
}
