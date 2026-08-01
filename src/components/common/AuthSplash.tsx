import { Truck } from "lucide-react";

/**
 * Full-screen branded splash shown while the persisted auth session is being
 * restored. Prevents the Login page (or landing page) from flashing before we
 * know whether the user already has a valid session.
 */
export function AuthSplash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Truck className="h-7 w-7" />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold tracking-tight">TransCore AI</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Restoring session…</div>
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[tc-slide_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}
