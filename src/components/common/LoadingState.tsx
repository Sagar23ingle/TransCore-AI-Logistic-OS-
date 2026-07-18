export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <span className="flex gap-1 items-center">
        <span className="loading-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="loading-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "200ms" }} />
        <span className="loading-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "400ms" }} />
      </span>
      <span className="font-mono text-xs tracking-wider">{label}</span>
    </div>
  );
}
