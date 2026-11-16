// Tests the APNs client (src/lib/apns.ts) against a local HTTP/2 server — no
// Apple credentials or network needed:
//   node --experimental-strip-types scripts/test-push.mjs
import { generateKeyPairSync, verify } from "node:crypto";
import http2 from "node:http2";
import { createProviderToken, loadApnsConfig, sendApns, buildApnsBody } from "../src/lib/apns.ts";

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const cfg = { keyId: "ABC123DEFG", teamId: "TEAM123456", privateKey: pem, topic: "com.arrison.footballpool" };

console.log("config");
check("null when unset", loadApnsConfig({}) === null);
const envCfg = loadApnsConfig({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T", APNS_KEY: pem.replace(/\n/g, "\\n"), APNS_TOPIC: "x" });
check("accepts single-line key with literal \\n", envCfg?.privateKey === pem, envCfg?.privateKey?.slice(0, 40));

console.log("provider token (JWT)");
const jwt = createProviderToken(cfg, 1_700_000_000);
const [h, c, s] = jwt.split(".");
const header = JSON.parse(Buffer.from(h, "base64url").toString());
const claims = JSON.parse(Buffer.from(c, "base64url").toString());
check("header is ES256 with key id", header.alg === "ES256" && header.kid === cfg.keyId, header);
check("claims carry team id and iat", claims.iss === cfg.teamId && claims.iat === 1_700_000_000, claims);
check("signature is raw r||s (64 bytes)", Buffer.from(s, "base64url").length === 64);
check(
  "signature verifies with the public key",
  verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")),
);

console.log("payload");
const body = JSON.parse(buildApnsBody({ title: "T", body: "B", data: { tab: "picks", week: "11" } }));
check("alert + custom data", body.aps.alert.title === "T" && body.aps.alert.body === "B" && body.tab === "picks" && body.week === "11", body);

console.log("send (local h2c server)");
const seen = [];
const server = http2.createServer((req, res) => {
  let data = "";
  req.on("data", (d) => (data += d));
  req.on("end", () => {
    const token = req.headers[":path"].split("/").pop();
    seen.push({ headers: req.headers, body: data, token });
    const reply = (status, reason) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(reason ? JSON.stringify({ reason }) : "");
    };
    if (token.startsWith("dead")) return reply(410, "Unregistered");
    if (token.startsWith("bad")) return reply(400, "BadDeviceToken");
    if (token.startsWith("exp")) return reply(403, "ExpiredProviderToken");
    reply(200);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const results = await sendApns(
  { ...cfg, hostOverride: origin },
  [
    { token: "good0001", environment: "sandbox" },
    { token: "dead0002", environment: "production" },
    { token: "bad00003", environment: "sandbox" },
    { token: "exp00004", environment: "sandbox" },
  ],
  { title: "Week 11 picks are due", body: "Sam hasn't picked yet.", data: { tab: "picks" } },
);
const by = Object.fromEntries(results.map((r) => [r.token, r]));
check("200 → ok, kept", by.good0001.ok && !by.good0001.remove, by.good0001);
check("410 Unregistered → remove", !by.dead0002.ok && by.dead0002.remove && by.dead0002.reason === "Unregistered", by.dead0002);
check("400 BadDeviceToken → remove", by.bad00003.remove, by.bad00003);
check("403 ExpiredProviderToken → failed but NOT removed", !by.exp00004.ok && !by.exp00004.remove, by.exp00004);
const first = seen.find((x) => x.token === "good0001");
check("POST to /3/device/<token>", first.headers[":method"] === "POST" && first.headers[":path"] === "/3/device/good0001", first.headers[":path"]);
check("bearer JWT + topic + alert push type", /^bearer \S+\.\S+\.\S+$/.test(first.headers.authorization) && first.headers["apns-topic"] === cfg.topic && first.headers["apns-push-type"] === "alert", first.headers);
check("body is the alert payload", JSON.parse(first.body).aps.alert.title === "Week 11 picks are due");
server.close();

console.log("unreachable host");
const down = await sendApns({ ...cfg, hostOverride: "http://127.0.0.1:1" }, [{ token: "good0001", environment: "sandbox" }], { title: "x", body: "y" });
check("connection failure reported, token kept", down[0].reason === "ConnectionFailed" && !down[0].remove && !down[0].ok, down[0]);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
