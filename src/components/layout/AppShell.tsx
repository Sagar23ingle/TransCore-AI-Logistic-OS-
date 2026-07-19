import { type ReactNode } from "react";
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
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto w-full max-w-[1400px] px-4 pt-3 pb-[calc(72px+env(safe-area-inset-bottom))] sm:px-6 sm:pt-5 lg:px-8 lg:pt-6 lg:pb-10">
          {(title || action) && (
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mb-6 sm:items-end sm:gap-3">
              <div className="min-w-0">
                {title && (
                  <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight sm:text-2xl">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{description}</p>
                )}
              </div>
              {action && <div className="shrink-0">{action}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
      <MobileBottomBar />
    </div>
  );
}
