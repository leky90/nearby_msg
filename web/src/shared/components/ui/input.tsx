/* eslint-disable react-refresh/only-export-components */
import {
  composeRenderProps,
  type InputProps,
  Input as RACInput,
} from "react-aria-components";
import { tv } from "tailwind-variants";

export const inputStyles = tv({
  base: [
    "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-12 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-body leading-body shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-body file:font-medium [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
  ],
  variants: {
    isDisabled: {
      true: "pointer-events-none cursor-not-allowed opacity-50",
    },
    isFocusVisible: {
      true: "border-ring ring-ring/50 ring-[3px]",
    },
    isFocused: {
      true: "border-ring ring-ring/50 z-10 ring-[3px]",
    },
    isInvalid: {
      true: "ring-destructive/20 dark:ring-destructive/40 border-destructive",
    },
  },
});

function Input({ className, type, ...props }: InputProps) {
  return (
    <RACInput
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (className, renderProps) =>
        inputStyles({ ...renderProps, className })
      )}
      {...props}
    />
  );
}

export { Input };
