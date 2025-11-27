/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 */

import { Component, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { AlertCircle } from "lucide-react";
import { t } from "@/lib/i18n";

export interface ErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Fallback UI to show on error */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component
 * Catches JavaScript errors in child components and displays fallback UI
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("error.unknown")}</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                {t("error.unknown")}
              </p>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    {t("error.unknown")}
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                    {this.state.error.toString()}
                    {this.state.error.stack && `\n${this.state.error.stack}`}
                  </pre>
                </details>
              )}
              <div className="mt-4 flex gap-2">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  {t("common.tryAgain") || t("button.back")}
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                  size="sm"
                >
                  {t("common.refresh") || t("button.back")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
