import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Mic, MicOff, Volume2, VolumeX, Square, RotateCcw, Loader2, Settings2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { askCompanyAi } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/ai/")({
  head: () => ({ meta: [{ title: "AI Assistant — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: AiPage,
});

interface Msg { role: "user" | "assistant" | "error"; text: string }

type VoiceState = "idle" | "listening" | "processing" | "speaking";

// Recognition languages — covers Indian + major world locales. "auto" cycles
// through India-first fallbacks so Hindi/Hinglish/English all get a shot.
const REC_LANGS: Array<{ value: string; label: string }> = [
  { value: "auto", label: "Auto (Hindi + English)" },
  { value: "hi-IN", label: "हिन्दी (India)" },
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "mr-IN", label: "मराठी" },
  { value: "bn-IN", label: "বাংলা" },
  { value: "ta-IN", label: "தமிழ்" },
  { value: "te-IN", label: "తెలుగు" },
  { value: "gu-IN", label: "ગુજરાતી" },
  { value: "kn-IN", label: "ಕನ್ನಡ" },
  { value: "ml-IN", label: "മലയാളം" },
  { value: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { value: "ur-IN", label: "اُردُو" },
  { value: "ar-SA", label: "العربية" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "pt-BR", label: "Português (BR)" },
  { value: "ru-RU", label: "Русский" },
  { value: "zh-CN", label: "中文" },
  { value: "ja-JP", label: "日本語" },
];
const AUTO_CHAIN = ["hi-IN", "en-IN", "en-US"];

// Minimal typings for the Web Speech API (not in lib.dom).
interface SRAlt { transcript: string }
interface SRRes { 0: SRAlt; isFinal: boolean }
interface SREvent { resultIndex: number; results: ArrayLike<SRRes> }
interface SRErr { error: string }
interface SpeechRec extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErr) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SRCtor = new () => SpeechRec;

function getSpeechRecognition(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function AiPage() {
  const askFn = useServerFn(askCompanyAi);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [rate, setRate] = useState(1);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [recLang, setRecLang] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    return window.localStorage.getItem("tc.voice.lang") || "auto";
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [continuous, setContinuous] = useState(false);

  const recRef = useRef<SpeechRec | null>(null);
  const finalRef = useRef<string>("");
  const autoIdxRef = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const SR = useMemo(() => getSpeechRecognition(), []);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => { try { window.localStorage.setItem("tc.voice.lang", recLang); } catch { /* noop */ } }, [recLang]);

  // Load voices
  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      if (!voiceURI && v.length) {
        const pref = v.find((x) => /en-IN|hi-IN/i.test(x.lang)) ?? v.find((x) => /en/i.test(x.lang)) ?? v[0];
        setVoiceURI(pref.voiceURI);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [ttsSupported, voiceURI]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, voiceState]);

  const send = useMutation({
    mutationFn: async (question: string) => askFn({ data: { question } }),
    onSuccess: (r) => {
      if (r.ok) {
        setMessages((m) => [...m, { role: "assistant", text: r.response }]);
        if (ttsEnabled) speak(r.response);
        else if (continuous) startListening();
        else setVoiceState("idle");
      } else {
        setMessages((m) => [...m, { role: "error", text: r.error }]);
        setVoiceState("idle");
      }
    },
    onError: () => {
      setMessages((m) => [...m, { role: "error", text: "AI service temporarily unavailable. Please try again later." }]);
      setVoiceState("idle");
    },
  });

  const submit = useCallback((raw: string) => {
    const p = raw.trim();
    if (!p || send.isPending) return;
    // Build short conversation memory (last 8 turns) for follow-ups.
    const history = messages.slice(-8).filter((m) => m.role !== "error");
    const framed = history.length
      ? `Prior conversation (for context, do not repeat):\n${history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")}\n\nCurrent question: ${p}`
      : p;
    setMessages((m) => [...m, { role: "user", text: p }]);
    setInput("");
    setVoiceState("processing");
    send.mutate(framed);
  }, [messages, send]);

  function handleSend() { submit(input); }

  function speak(text: string) {
    if (!ttsSupported || !ttsEnabled) { setVoiceState("idle"); return; }
    window.speechSynthesis.cancel();
    // Split long responses into sentence chunks for smoother playback.
    const chunks = text.match(/[^.!?\n।]+[.!?\n।]?/g) ?? [text];
    setVoiceState("speaking");
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
    let i = 0;
    const next = () => {
      if (i >= chunks.length) {
        setVoiceState("idle");
        if (continuous) startListening();
        return;
      }
      const chunk = chunks[i++].trim();
      if (!chunk) { next(); return; }
      const u = new SpeechSynthesisUtterance(chunk);
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = next;
      u.onerror = () => { setVoiceState("idle"); };
      window.speechSynthesis.speak(u);
    };
    next();
  }

  function stopSpeaking() {
    if (ttsSupported) window.speechSynthesis.cancel();
    setVoiceState("idle");
  }

  function replay() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) speak(last.text);
  }

  const startListening = useCallback(async () => {
    if (!SR) { toast.error("Voice input isn't supported in this browser."); return; }
    if (voiceState === "listening" || send.isPending) return;
    if (ttsSupported) window.speechSynthesis.cancel();

    // On Android WebViews mic permission is only granted after an explicit
    // getUserMedia call; do it once so SpeechRecognition doesn't silently fail.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        toast.error("Microphone blocked. Allow mic access in browser settings.");
        return;
      }
    }

    try {
      const rec = new SR();
      const activeLang = recLang === "auto" ? AUTO_CHAIN[autoIdxRef.current % AUTO_CHAIN.length] : recLang;
      rec.lang = activeLang;
      rec.continuous = true; // keep session open; we finalize on onend / silence
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      finalRef.current = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalRef.current += res[0].transcript + " ";
          else interim += res[0].transcript;
        }
        setInput((finalRef.current + interim).trim());
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          toast.error("Microphone permission denied. Enable it in browser settings.");
          setVoiceState("idle");
          return;
        }
        if (ev.error === "language-not-supported" && recLang === "auto") {
          autoIdxRef.current += 1;
          setVoiceState("idle");
          startListening();
          return;
        }
        if (ev.error !== "no-speech" && ev.error !== "aborted") {
          toast.error(`Voice error: ${ev.error}`);
        }
        setVoiceState("idle");
      };
      rec.onend = () => {
        const finalText = finalRef.current.trim();
        recRef.current = null;
        if (finalText) {
          if (recLang === "auto") autoIdxRef.current = 0; // reset after success
          submit(finalText);
        } else {
          // Auto mode: rotate to next language if the current one heard nothing.
          if (recLang === "auto" && voiceState === "listening") {
            autoIdxRef.current += 1;
            if (autoIdxRef.current < AUTO_CHAIN.length) {
              setVoiceState("idle");
              startListening();
              return;
            }
            autoIdxRef.current = 0;
          }
          setVoiceState("idle");
        }
      };
      recRef.current = rec;
      setVoiceState("listening");
      rec.start();
    } catch {
      setVoiceState("idle");
    }
  }, [SR, voiceState, send.isPending, ttsSupported, submit, recLang]);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
  }, []);

  useEffect(() => () => {
    try { recRef.current?.abort(); } catch { /* noop */ }
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [ttsSupported]);

  function onMicPointerDown() {
    longPressTimer.current = setTimeout(() => {
      setContinuous(true);
      toast.success("Continuous conversation on");
      startListening();
    }, 550);
  }
  function onMicPointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      if (voiceState === "listening") stopListening();
      else startListening();
    } else if (voiceState === "listening") {
      stopListening();
    }
  }
  function exitContinuous() {
    setContinuous(false);
    stopListening();
    stopSpeaking();
  }

  const statusLabel =
    voiceState === "listening" ? "🎤 Listening..." :
    voiceState === "processing" ? "🤖 Thinking..." :
    voiceState === "speaking" ? "🔊 Speaking..." : null;

  const micDisabled = !SR;

  const settingsAction = (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Voice settings">
          <Settings2 className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <Label className="text-xs">Recognition language</Label>
          <Select value={recLang} onValueChange={setRecLang}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {REC_LANGS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">Auto cycles Hindi → English (India) → English (US).</p>
        </div>

        {ttsSupported && (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-toggle" className="text-xs">Speak replies aloud</Label>
              <Switch id="tts-toggle" checked={ttsEnabled} onCheckedChange={setTtsEnabled} />
            </div>
            <div>
              <Label className="text-xs">Voice</Label>
              <Select value={voiceURI} onValueChange={setVoiceURI}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="System default" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {voices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <Label>Speed</Label>
                <span className="tabular-nums text-muted-foreground">{rate.toFixed(2)}x</span>
              </div>
              <Slider value={[rate]} min={0.5} max={1.75} step={0.05} onValueChange={(v) => setRate(v[0])} className="mt-2" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={stopSpeaking} disabled={voiceState !== "speaking"}>
                <Square className="h-3.5 w-3.5 mr-1" /> Stop
              </Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={replay} disabled={!messages.some((m) => m.role === "assistant")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Replay
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <AppShell
      title="AI Assistant"
      description="Ask Gemini about your fleet — grounded in your real data."
      action={settingsAction}
    >
      <div className="grid gap-4">
        <Card>
          <CardContent ref={scrollRef} className="space-y-3 py-6 max-h-[55vh] overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Tap the mic and speak, or type. Try: "Which vehicle has the highest fuel cost this month?"
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
            {statusLabel && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {voiceState === "listening" && <VoiceWave />}
                {voiceState === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>{statusLabel}</span>
                {continuous && (
                  <button onClick={exitContinuous} className="ml-2 underline">Exit conversation</button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex items-end gap-2">
          <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
            placeholder={voiceState === "listening" ? "Listening..." : "Ask, or press & hold mic for a live conversation"} />
          <Button
            type="button"
            variant={voiceState === "listening" ? "destructive" : "secondary"}
            disabled={micDisabled || send.isPending}
            onPointerDown={onMicPointerDown}
            onPointerUp={onMicPointerUp}
            onPointerLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
            className={`relative ${voiceState === "listening" ? "animate-pulse shadow-[0_0_0_6px_rgba(239,68,68,0.15)]" : ""}`}
            title={micDisabled ? "Voice not supported in this browser" : "Tap to speak · Hold for continuous"}
          >
            {voiceState === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          {ttsSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTtsEnabled((v) => !v)}
              title={ttsEnabled ? "Mute replies" : "Unmute replies"}
            >
              {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          )}
          <Button onClick={handleSend} disabled={send.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {!SR && (
          <p className="text-xs text-muted-foreground">Voice input isn't supported in this browser. Chrome (Android/Desktop) and Safari (iOS) work best.</p>
        )}
      </div>
    </AppShell>
  );
}

function VoiceWave() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-primary rounded-sm animate-[wave_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.12}s`, height: "100%" }}
        />
      ))}
      <style>{`@keyframes wave{0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(1)}}`}</style>
    </span>
  );
}
