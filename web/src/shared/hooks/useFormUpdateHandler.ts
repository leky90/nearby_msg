/**
 * Custom hook for handling form updates with Redux
 * Follows SOLID principles - Single Responsibility: handles update state management
 * Interface Segregation: only requires the methods we actually use
 */

import { useEffect, useRef } from "react";
import { showToast } from "@/shared/utils/toast";

// Minimal interface - only what we need (Interface Segregation Principle)
interface FormInstance {
  setError: (name: "root", error: { message: string }) => void;
}

export interface UseFormUpdateHandlerOptions {
  /** Form instance from react-hook-form (only needs setError method) */
  form: FormInstance;
  /** Whether the form is currently being edited */
  isEditing: boolean;
  /** Whether the update is in progress */
  isUpdating: boolean;
  /** Error message from Redux (null if no error) */
  updateError: string | null;
  /** Current value from Redux store (to compare with submitted value) */
  currentValue: string | null | undefined;
  /** Callback to close editing mode */
  onCloseEdit: () => void;
  /** Success message to show when update succeeds */
  successMessage?: string;
}

/**
 * Hook to handle form update success/error states from Redux
 * Prevents infinite loops by tracking submitted values
 */
export function useFormUpdateHandler({
  form,
  isEditing,
  isUpdating,
  updateError,
  currentValue,
  onCloseEdit,
  successMessage = "Đã cập nhật thành công",
}: UseFormUpdateHandlerOptions) {
  // Track the value that was submitted to prevent loop
  const submittedValueRef = useRef<string | null>(null);

  // Handle update errors and success from Redux
  useEffect(() => {
    if (updateError && isEditing) {
      showToast(updateError, "error");
      form.setError("root", { message: updateError });
      onCloseEdit();
      submittedValueRef.current = null;
    } else if (
      !isUpdating &&
      isEditing &&
      !updateError &&
      submittedValueRef.current !== null &&
      currentValue === submittedValueRef.current
    ) {
      // Update succeeded - only trigger if this was our update
      showToast(successMessage, "success");
      onCloseEdit();
      submittedValueRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateError, isUpdating, isEditing, currentValue, successMessage]);

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    submittedValueRef.current = trimmed;
    return trimmed;
  };

  const handleCancel = () => {
    submittedValueRef.current = null;
  };

  return {
    handleSubmit,
    handleCancel,
  };
}
