import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function AppShell({ children, title, description, action }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {(title || action) && (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {action}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
