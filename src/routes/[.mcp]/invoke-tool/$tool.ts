// Owned locally: adds `as never` cast to satisfy TanStack Start's strict route options typing.
// route: /.mcp/invoke-tool/$tool
// emitted to: src/routes/[.mcp]/invoke-tool/$tool.ts

import { createFileRoute } from "@tanstack/react-router";

import { createTanStackInvokeToolHandler } from "@lovable.dev/mcp-js/stacks/tanstack";

import mcp from "../../../lib/mcp/index";

export const Route = createFileRoute("/.mcp/invoke-tool/$tool")({
  server: {
    handlers: {
      ANY: createTanStackInvokeToolHandler(mcp, { resourcePath: "/mcp", metadataPath: "/.well-known/oauth-protected-resource", trustForwardedHost: true }),
    },
  },
} as never);
