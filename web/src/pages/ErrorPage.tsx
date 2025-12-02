/**
 * Error Page Component
 * Displays error UI for router errors
 */

import {
  useRouteError,
  isRouteErrorResponse,
  useNavigate,
} from "react-router-dom";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { log } from "@/shared/lib/logging/logger";

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log error for debugging
  if (error) {
    log.error("Router error", error);
  }

  // Determine error message
  let errorMessage = "Đã xảy ra lỗi không mong muốn.";
  let errorDetails: string | null = null;

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || `Lỗi ${error.status}`;
    if (error.data && typeof error.data === "string") {
      errorDetails = error.data;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
    errorDetails = error.stack || null;
  }

  const handleGoHome = () => {
    navigate("/", { replace: true });
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Đã xảy ra lỗi</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-4">{errorMessage}</p>
          {import.meta.env.DEV && errorDetails && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">
                Chi tiết lỗi
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                {errorDetails}
              </pre>
            </details>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleGoHome}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Về trang chủ
            </Button>
            <Button onClick={handleReload} variant="default" size="sm">
              Làm mới trang
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
