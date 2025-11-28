/**
 * Radius Filter Component
 * Selector for search radius (500m, 1km, 2km)
 */

import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';

export type RadiusOption = 500 | 1000 | 2000;

export interface RadiusFilterProps {
  /** Current selected radius */
  radius: RadiusOption;
  /** Callback when radius changes */
  onRadiusChange: (radius: RadiusOption) => void;
  /** Custom className */
  className?: string;
}

const RADIUS_OPTIONS: Array<{ value: RadiusOption; label: string }> = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
];

/**
 * Radius Filter component
 * Allows users to select search radius using shadcn ToggleGroup
 */
export function RadiusFilter({
  radius,
  onRadiusChange,
  className = '',
}: RadiusFilterProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label>Search Radius</Label>
      <ToggleGroup
        type="single"
        value={radius.toString()}
        onValueChange={(value) => {
          if (value) {
            onRadiusChange(Number(value) as RadiusOption);
          }
        }}
      >
        {RADIUS_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value.toString()}
            aria-label={`Chọn bán kính ${option.label}`}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

