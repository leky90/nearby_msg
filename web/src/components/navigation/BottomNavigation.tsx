import { AlertTriangle, Star, Compass, User } from "lucide-react";
import { useNavigationStore, type TabType } from "@/stores/navigation-store";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const tabs: {
  id: TabType | "user";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  activeColor: string;
  inactiveColor: string;
}[] = [
  {
    id: "sos",
    icon: AlertTriangle,
    label: "SOS",
    activeColor: "text-sos",
    inactiveColor: "text-foreground/60",
  },
  {
    id: "following",
    icon: Star,
    label: "Quan tâm",
    activeColor: "text-yellow",
    inactiveColor: "text-foreground/60",
  },
  {
    id: "explore",
    icon: Compass,
    label: "Khám phá",
    activeColor: "text-info",
    inactiveColor: "text-foreground/60",
  },
  {
    id: "user",
    icon: User,
    label: "Tài khoản",
    activeColor: "text-safety",
    inactiveColor: "text-foreground/60",
  },
];

export function BottomNavigation() {
  const { activeTab, setActiveTab } = useNavigationStore();
  const { userStatus } = useAppStore();

  const statusRingColor =
    userStatus?.status_type === "need_help"
      ? "ring-sos"
      : userStatus?.status_type === "cannot_contact"
        ? "ring-warning"
        : "ring-safety";

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/80 backdrop-blur-lg border-t",
        "pb-[env(safe-area-inset-bottom,0px)]",
        "h-16 w-full max-w-full",
        "overflow-x-hidden"
      )}
    >
      <div className="flex items-center justify-around h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isUserTab = tab.id === "user";

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isUserTab) {
                  setActiveTab("status");
                } else {
                  setActiveTab(tab.id as TabType);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 sm:gap-1",
                "flex-1 h-full min-w-0 px-1",
                "transition-all duration-200",
                "active:scale-95",
                (isActive || (isUserTab && activeTab === "status"))
                  ? cn(
                      tab.activeColor,
                      "font-semibold",
                      tab.id === "sos" && "bg-sos/15 shadow-sm",
                      tab.id === "following" && "bg-yellow/15 shadow-sm",
                      tab.id === "explore" && "bg-info/15 shadow-sm",
                      tab.id === "user" && "bg-safety/15 shadow-sm",
                      "rounded-t-lg"
                    )
                  : cn(tab.inactiveColor, "hover:text-foreground/90")
              )}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              {isUserTab ? (
                <div className="relative">
                  <Icon
                    className={cn(
                      "w-5 h-5 sm:w-6 sm:h-6 transition-transform",
                      isActive && "scale-125"
                    )}
                  />
                  <div
                    className={cn(
                      "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-background transition-all",
                      statusRingColor,
                      isActive && "w-2.5 h-2.5"
                    )}
                  />
                </div>
              ) : (
                <Icon
                  className={cn(
                    "w-5 h-5 sm:w-6 sm:h-6 transition-transform",
                    isActive && "scale-125"
                  )}
                />
              )}
              <span className="text-[10px] sm:text-xs leading-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
