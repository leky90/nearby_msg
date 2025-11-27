import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { tv } from "tailwind-variants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Focus ring utility for tailwind-variants
 * Provides consistent focus ring styling across components
 */
export const focusRing = tv({
  variants: {
    isFocusVisible: {
      true: "ring-2 ring-ring ring-offset-2",
      false: "outline-none",
    },
  },
})
