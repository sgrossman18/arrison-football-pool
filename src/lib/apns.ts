// Minimal Apple Push Notification service client: token-based (.p8) auth over
// HTTP/2, using only Node built-ins. No database access here so it can be
// tested in isolation (see scripts/test-push.mjs).
import { createPrivateKey, sign } from "node:crypto";
import http2 from "node:http2";

export type ApnsEnvironment = "sandbox" | "production";

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  privateKey: string; // PEM contents of the AuthKey_XXXX.p8 file
  topic: string; // the app's bundle id
  // Testing only: send everything to this origin (e.g. a local h2c server).
  hostOverride?: string;
};

export type ApnsPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type ApnsResult = {
  token: string;
  ok: boolean;
  status: number;
  reason?: string;
  // The token is dead (app deleted, wrong environment…) — stop sending to it.
  remove: boolean;
};

const ORIGINS: Record<ApnsEnvironment, string> = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

// APNs wants the provider token refreshed at most hourly and at least every
// 60 minutes; reuse one for 40.
const TOKEN_TTL_SECONDS = 40 * 60;
const REQUEST_TIMEOUT_MS = 10_000;

// Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY (the .p8 text; literal "\n" is
// accepted so it fits on one line in Vercel), APNS_TOPIC. Returns null when
// push isn't configured, so callers can fall back to logging (dev mode).
export function loadApnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY, APNS_TOPIC } = env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_KEY || !APNS_TOPIC) return null;
  return {
    keyId: APNS_KEY_ID,
    teamId: APNS_TEAM_ID,
    privateKey: APNS_KEY.replace(/\\n/g, "\n"),
    topic: APNS_TOPIC,
    hostOverride: env.APNS_HOST_OVERRIDE || undefined,
  };
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function createProviderToken(cfg: ApnsConfig, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: nowSeconds }));
  const signingInput = `${header}.${claims}`;
  // JWS ES256 signatures are raw r||s, not DER.
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(cfg.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(signature)}`;
}

let cached: { keyId: string; token: string; issuedAt: number } | null = null;

function providerToken(cfg: ApnsConfig, nowSeconds: number): string {
  if (cached && cached.keyId === cfg.keyId && nowSeconds - cached.issuedAt < TOKEN_TTL_SECONDS) {
    return cached.token;
  }
  const token = createProviderToken(cfg, nowSeconds);
  cached = { keyId: cfg.keyId, token, issuedAt: nowSeconds };
  return token;
}

export function buildApnsBody(payload: ApnsPayload): string {
  return JSON.stringify({
    ...payload.data,
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
  });
}

// A token the server will never accept again.
function shouldRemove(status: number, reason?: string): boolean {
  return (
    status === 410 ||
    (status === 400 && (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic"))
  );
}

export async function sendApns(
  cfg: ApnsConfig,
  targets: { token: string; environment: ApnsEnvironment }[],
  payload: ApnsPayload,
): Promise<ApnsResult[]> {
  const body = buildApnsBody(payload);
  const jwt = providerToken(cfg, Math.floor(Date.now() / 1000));
  const results: ApnsResult[] = [];

  const byOrigin = new Map<string, string[]>();
  for (const t of targets) {
    const origin = cfg.hostOverride ?? ORIGINS[t.environment];
    byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), t.token]);
  }

  for (const [origin, tokens] of byOrigin) {
    let session: http2.ClientHttp2Session;
    try {
      session = http2.connect(origin);
      // Without a handler a connection error would crash the process.
      session.on("error", () => {});
      await new Promise<void>((resolve, reject) => {
        session.once("connect", () => resolve());
        session.once("error", reject);
      });
    } catch {
      for (const token of tokens) {
        results.push({ token, ok: false, status: 0, reason: "ConnectionFailed", remove: false });
      }
      continue;
    }

    const sent = await Promise.all(
      tokens.map(
        (token) =>
          new Promise<ApnsResult>((resolve) => {
            const req = session.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              "apns-topic": cfg.topic,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "content-type": "application/json",
            });
            let status = 0;
            let data = "";
            const timer = setTimeout(() => {
              req.close(http2.constants.NGHTTP2_CANCEL);
              resolve({ token, ok: false, status: 0, reason: "Timeout", remove: false });
            }, REQUEST_TIMEOUT_MS);
            req.on("response", (headers) => {
              status = Number(headers[":status"] ?? 0);
            });
            req.setEncoding("utf8");
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              clearTimeout(timer);
              let reason: string | undefined;
              try {
                reason = data ? (JSON.parse(data).reason as string | undefined) : undefined;
              } catch {
                // non-JSON error body
              }
              resolve({ token, ok: status === 200, status, reason, remove: shouldRemove(status, reason) });
            });
            req.on("error", () => {
              clearTimeout(timer);
              resolve({ token, ok: false, status: 0, reason: "RequestFailed", remove: false });
            });
            req.end(body);
          }),
      ),
    );
    results.push(...sent);
    session.close();
  }
  return results;
}
