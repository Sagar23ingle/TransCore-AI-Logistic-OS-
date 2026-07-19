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
            <div className="mb-3 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div className="min-w-0">
                {title && (
                  <h1 className="text-[20px] font-semibold leading-tight tracking-tight break-words sm:text-2xl">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{description}</p>
                )}
              </div>
              {action && (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 [&>*]:min-w-0">
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
