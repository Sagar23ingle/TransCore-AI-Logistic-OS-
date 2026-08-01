import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileBottomBar } from "./MobileBottomBar";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function AppShell({ children, title, description, action }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBack = pathname !== "/dashboard" && pathname !== "/";
  const isAi = pathname === "/ai" || pathname.startsWith("/ai/");
  return (
    <div className={isAi ? "h-[100dvh] overflow-hidden bg-background text-foreground" : "min-h-dvh bg-background text-foreground"}>
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main
          className={
            isAi
              ? "mx-auto flex w-full max-w-[1000px] flex-col overflow-hidden px-3 pt-1.5 pb-0 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4 lg:pb-4"
              : "mx-auto w-full max-w-[1400px] px-4 pt-3 pb-[calc(104px+env(safe-area-inset-bottom))] sm:px-6 sm:pt-5 lg:px-8 lg:pt-6 lg:pb-10"
          }
        >
          {showBack && (
            <Link
              to="/dashboard"
              aria-label="Back to dashboard"
              className={`${isAi ? "mb-1.5" : "mb-3"} inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-[var(--shadow-neo-sm)] transition-all duration-200 active:scale-95 active:shadow-[var(--shadow-neo-inset)] hover:shadow-[var(--glow-primary)] hover:text-primary lg:hidden`}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </Link>
          )}
          {(title || action) && (
            <div className={`${isAi ? "mb-1.5 flex-row items-center justify-between sm:mb-3" : "mb-3 flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-3"} flex shrink-0`}>
              <div className="min-w-0">
                {title && (
                  <h1 className={`font-semibold leading-tight tracking-tight break-words ${isAi ? "text-[17px] sm:text-xl" : "text-[20px] sm:text-2xl"}`}>
                    {title}
                  </h1>
                )}
                {description && (
                  <p className={`mt-0.5 hidden text-sm text-muted-foreground ${isAi ? "lg:block" : "sm:block"}`}>{description}</p>
                )}
              </div>
              {action && (
                <div className={`flex gap-2 ${isAi ? "shrink-0" : "w-full flex-wrap sm:w-auto sm:shrink-0"} [&>*]:min-w-0`}>
                  {action}
                </div>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
      <MobileBottomBar />
    </div>
  );
}
