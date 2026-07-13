import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { runAi, buildFleetContext } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/ai/")({
  head: () => ({ meta: [{ title: "AI Assistant — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: AiPage,
});

interface Msg { role: "user" | "assistant" | "error"; text: string }

function AiPage() {
  const runFn = useServerFn(runAi);
  const ctxFn = useServerFn(buildFleetContext);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const send = useMutation({
    mutationFn: async (prompt: string) => {
      const ctx = await ctxFn();
      const composed = `You may reference this fleet context (only what's below is real):
${JSON.stringify(ctx, null, 2)}

User question: ${prompt}`;
      return runFn({ data: { kind: "chat", prompt: composed } });
    },
    onSuccess: (r) => {
      if (r.ok) setMessages((m) => [...m, { role: "assistant", text: r.response }]);
      else setMessages((m) => [...m, { role: "error", text: r.error }]);
    },
    onError: () => setMessages((m) => [...m, { role: "error", text: "AI service temporarily unavailable. Please try again later." }]),
  });

  function handleSend() {
    const p = input.trim();
    if (!p || send.isPending) return;
    setMessages((m) => [...m, { role: "user", text: p }]);
    setInput("");
    send.mutate(p);
  }

  return (
    <AppShell title="AI Assistant" description="Ask Gemini about your fleet — grounded in your real data.">
      <div className="grid gap-4">
        <Card>
          <CardContent className="space-y-3 py-6">
            {messages.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Try: "Which vehicle has the highest fuel cost this month?" or "Summarise last 5 trips."
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-primary/15 text-foreground" :
                  m.role === "error" ? "bg-destructive/15 text-destructive" :
                  "bg-secondary text-foreground"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {send.isPending && <div className="text-xs text-muted-foreground">Thinking...</div>}
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
            placeholder="Ask about your fleet, expenses, trips, drivers..." />
          <Button onClick={handleSend} disabled={send.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
