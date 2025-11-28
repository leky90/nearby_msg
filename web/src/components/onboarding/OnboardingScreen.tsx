/**
 * Onboarding Screen
 * First-time user experience - requires user to enter a nickname
 */

import { useState } from "react";
import { User, Loader2 } from "lucide-react";
import { useDevice } from "@/hooks/useDevice";
import { Input } from "@/components/ui/input";
import { validateNickname } from "@/domain/device";
import { showToast } from "@/utils/toast";
import { cn } from "@/lib/utils";

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { registerDevice, loading } = useDevice(false); // Don't fetch device during onboarding
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = nickname.trim();
    const validationError = validateNickname(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await registerDevice({ nickname: trimmed });
      showToast("Chào mừng bạn đến với Nearby Community Chat!", "success");
      // Wait a bit for device to be saved to RxDB and token to be set
      setTimeout(() => {
        onComplete();
      }, 100);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Lỗi khi đăng ký. Vui lòng thử lại.";
      setError(message);
      showToast(message, "error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Chào mừng bạn!</h1>
          <p className="text-muted-foreground">
            Vui lòng nhập tên hiển thị để bắt đầu sử dụng ứng dụng
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-medium">
              Tên hiển thị
            </label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError(null);
              }}
              placeholder="Nhập tên của bạn"
              maxLength={50}
              autoFocus
              disabled={loading}
              className={cn(error && "border-destructive")}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {nickname.length}/50 ký tự. Chỉ được dùng chữ, số, khoảng trắng và
              dấu gạch ngang.
            </p>
          </div>

          <button
            type="submit"
            className="w-full h-12 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-default outline-none border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            disabled={loading || !nickname.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Bắt đầu"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
