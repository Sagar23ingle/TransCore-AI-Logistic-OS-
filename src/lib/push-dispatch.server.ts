// Server-only helper: dispatches Web Push notifications to a user's subscriptions.
// Never import this from a client-reachable module at top level.
import webpush from "web-push";

let configured = false;
function ensure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT ?? "mailto:alerts@transcoreai.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<{ sent: number; expired: string[] }> {
  if (!ensure() || targets.length === 0) return { sent: 0, expired: [] };
  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, { TTL: 60 * 60 * 24 });
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) expired.push(t.endpoint);
    }
  }));
  return { sent, expired };
}