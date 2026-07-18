// Allow the `server` field on createFileRoute options (used by TanStack Start
// server routes and the @lovable.dev/mcp-js generated routes).
declare module "@tanstack/router-core" {
  interface UpdatableRouteOptionsExtensions {
    server?: unknown;
  }
}
export {};
