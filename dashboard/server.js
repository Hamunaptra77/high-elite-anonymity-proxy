const fs = require("fs");
const http = require("http");
const { execFileSync } = require("child_process");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8088;
const ACCESS_LOG = process.env.ACCESS_LOG || "/logs/access.log";
const CACHE_LOG = process.env.CACHE_LOG || "/logs/cache.log";
const ALLOWED_DOMAINS_FILE = process.env.ALLOWED_DOMAINS_FILE || "/config/allowed_domains.txt";
const ENV_FILE = process.env.ENV_FILE || "/config/.env";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const SQUID_CONTAINER_NAME = process.env.SQUID_CONTAINER_NAME || "squid-privoxy";

app.use(express.json({ limit: "256kb" }));

function readLastLines(filePath, maxLines) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(Math.max(lines.length - maxLines, 0));
  } catch {
    return [];
  }
}

function parseAccessLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 10) {
    return null;
  }

  const result = parts[3] || "";
  const hierarchy = parts[8] || "";
  const [resultType, statusCode] = result.split("/");

  return {
    timestamp: Number(parts[0]) || 0,
    durationMs: Number(parts[1]) || 0,
    clientIp: parts[2],
    result,
    resultType: resultType || "",
    statusCode: statusCode || "",
    bytes: Number(parts[4]) || 0,
    method: parts[5],
    target: parts[6],
    username: parts[7],
    hierarchy,
    hierarchyPeer: hierarchy.includes("/") ? hierarchy.split("/")[1] : "-",
    contentType: parts[9] || "-"
  };
}

function getSummary() {
  const entries = readLastLines(ACCESS_LOG, 2000)
    .map(parseAccessLine)
    .filter(Boolean);

  let tunnel200 = 0;
  let denied403 = 0;
  let denied407 = 0;
  let otherErrors = 0;
  const peerUsage = {};

  for (const e of entries) {
    if (e.result === "TCP_TUNNEL/200") {
      tunnel200 += 1;
    }
    if (e.result === "TCP_DENIED/403") {
      denied403 += 1;
    }
    if (e.result === "TCP_DENIED/407") {
      denied407 += 1;
    }
    if (e.statusCode && !["200", "403", "407"].includes(e.statusCode)) {
      otherErrors += 1;
    }

    if (e.hierarchy.startsWith("ROUNDROBIN_PARENT/")) {
      const peer = e.hierarchyPeer;
      peerUsage[peer] = (peerUsage[peer] || 0) + 1;
    }
  }

  const cacheTail = readLastLines(CACHE_LOG, 120);

  return {
    accessLogPath: ACCESS_LOG,
    cacheLogPath: CACHE_LOG,
    totalEntries: entries.length,
    tunnel200,
    denied403,
    denied407,
    otherErrors,
    peerUsage,
    hasLogs: entries.length > 0,
    cacheTail,
    updatedAt: new Date().toISOString()
  };
}

function readAllowedDomainsRaw() {
  try {
    return fs.readFileSync(ALLOWED_DOMAINS_FILE, "utf8");
  } catch {
    return "";
  }
}

function validateAllowedDomains(content) {
  const lines = content.split(/\r?\n/);
  const errors = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) {
      continue;
    }

    if (raw.includes("/") || raw.includes(":")) {
      errors.push(`Zeile ${i + 1}: Nur Domain ohne Protokoll/Port erlaubt (${raw})`);
      continue;
    }

    if (!/^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(raw)) {
      errors.push(`Zeile ${i + 1}: Ungueltiges Domain-Format (${raw})`);
    }
  }

  return errors;
}

function readEnvRaw() {
  try {
    return fs.readFileSync(ENV_FILE, "utf8");
  } catch {
    return "";
  }
}

function parseEnvCredentials(content) {
  const lines = content.split(/\r?\n/);
  const result = { username: "", password: "" };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (trimmed.startsWith("SQUID_USERNAME=")) {
      result.username = trimmed.substring("SQUID_USERNAME=".length);
    }
    if (trimmed.startsWith("SQUID_PASSWORD=")) {
      result.password = trimmed.substring("SQUID_PASSWORD=".length);
    }
  }

  return result;
}

function validateCredentials(username, password) {
  const errors = [];
  if (!username || username.length < 3) {
    errors.push("Benutzername muss mindestens 3 Zeichen haben.");
  }
  if (username.includes(" ")) {
    errors.push("Benutzername darf keine Leerzeichen enthalten.");
  }
  if (!password || password.length < 12) {
    errors.push("Passwort muss mindestens 12 Zeichen haben.");
  }
  if (password === "change-me") {
    errors.push("Passwort darf nicht 'change-me' sein.");
  }
  return errors;
}

function extractPublicIpv4(text) {
  const raw = String(text || "");
  const compact = raw.replace(/\s+/g, "");
  const labeledMatch = compact.match(/IP:((?:\d{1,3}\.){3}\d{1,3})/i);
  if (labeledMatch && labeledMatch[1]) {
    const oct = labeledMatch[1].split(".").map((n) => Number(n));
    const validOctets = oct.length === 4 && oct.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const isPrivate =
      oct[0] === 10 ||
      (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) ||
      (oct[0] === 192 && oct[1] === 168) ||
      oct[0] === 127;
    if (validOctets && !isPrivate) {
      return labeledMatch[1];
    }
  }

  const matches = compact.match(/(?:\d{1,3}\.){3}\d{1,3}/g) || [];
  for (const ip of matches) {
    const oct = ip.split(".").map((n) => Number(n));
    const validOctets = oct.length === 4 && oct.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const isPrivate =
      oct[0] === 10 ||
      (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) ||
      (oct[0] === 192 && oct[1] === 168) ||
      oct[0] === 127;
    if (validOctets && !isPrivate) {
      return ip;
    }
  }
  return "";
}

function fetchIpFromService(useProxy = false) {
  if (useProxy) {
    const cmd = "U=$(sed -n \"s/^SQUID_USERNAME=//p\" /config/.env); "
      + "P=$(sed -n \"s/^SQUID_PASSWORD=//p\" /config/.env); "
      + "curl -L -sS --max-time 20 -x \"http://${U}:${P}@squid-privoxy:3128\" https://www.dein-ip-check.de/";
    try {
      const out = execFileSync("sh", ["-lc", cmd], { encoding: "utf8" });
      const ip = extractPublicIpv4(out);
      if (ip) {
        return { ip, error: "" };
      }
      return { ip: "", error: "Keine IP im Antworttext gefunden" };
    } catch (e) {
      const msg = String(e?.message || e || "").split("\n")[0];
      const stderr = String(e?.stderr || "").trim();
      const suffix = stderr ? ` (${stderr.slice(0, 120)})` : "";
      return { ip: "", error: `IP-Abfrage fehlgeschlagen: ${msg}${suffix}` };
    }
  }

  const services = ["https://ifconfig.me/ip", "https://api.ipify.org", "https://www.dein-ip-check.de/"];
  for (const targetUrl of services) {
    try {
      const out = execFileSync("curl", ["-L", "-sS", "--max-time", "20", targetUrl], { encoding: "utf8" });
      const ip = extractPublicIpv4(out);
      if (ip) {
        return { ip, error: "" };
      }
    } catch {
      // Try next service.
    }
  }

  return { ip: "", error: "Keine IP im Antworttext gefunden" };
}

const IP_CACHE_TTL_MS = 60000;
let ipCache = {
  directIp: "",
  directError: "Noch keine Abfrage",
  proxyExitIp: "",
  proxyError: "Noch keine Abfrage",
  updatedAt: ""
};

function getIpInfo() {
  const now = Date.now();
  const last = ipCache.updatedAt ? Date.parse(ipCache.updatedAt) : 0;
  const hasFreshSuccess = Boolean(ipCache.directIp) && Boolean(ipCache.proxyExitIp);
  if (last && now - last < IP_CACHE_TTL_MS && hasFreshSuccess) {
    return ipCache;
  }

  const direct = fetchIpFromService(false);
  const viaProxy = fetchIpFromService(true);
  ipCache = {
    directIp: direct.ip,
    directError: direct.error,
    proxyExitIp: viaProxy.ip,
    proxyError: viaProxy.error,
    updatedAt: new Date().toISOString()
  };
  return ipCache;
}

function dockerApiRequest(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path,
        method,
        headers: { "Content-Type": "application/json" }
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({ statusCode: res.statusCode || 0, body });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

app.use(express.static("public"));

app.get("/api/summary", (req, res) => {
  res.json(getSummary());
});

app.get("/api/access", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const rows = readLastLines(ACCESS_LOG, limit)
    .map(parseAccessLine)
    .filter(Boolean)
    .reverse();

  res.json({ rows, limit, updatedAt: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, updatedAt: new Date().toISOString() });
});

app.get("/api/ip", (req, res) => {
  const ipInfo = getIpInfo();
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();

  res.json({
    clientIp,
    directIp: ipInfo.directIp,
    directError: ipInfo.directError,
    proxyExitIp: ipInfo.proxyExitIp,
    proxyError: ipInfo.proxyError,
    updatedAt: ipInfo.updatedAt
  });
});

app.get("/api/allowed-domains", (req, res) => {
  const content = readAllowedDomainsRaw();
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  res.json({
    path: ALLOWED_DOMAINS_FILE,
    content,
    domains: lines,
    count: lines.length,
    updatedAt: new Date().toISOString()
  });
});

app.post("/api/allowed-domains", (req, res) => {
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const normalized = content.replace(/\r\n/g, "\n");
  const errors = validateAllowedDomains(normalized);

  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    fs.writeFileSync(ALLOWED_DOMAINS_FILE, normalized.endsWith("\n") ? normalized : `${normalized}\n`, "utf8");
    return res.json({
      ok: true,
      message: "allowed_domains.txt gespeichert. Bitte squid-privoxy neu starten, damit Aenderungen aktiv werden.",
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "Datei konnte nicht gespeichert werden." });
  }
});

app.get("/api/env", (req, res) => {
  const content = readEnvRaw();
  const parsed = parseEnvCredentials(content);
  res.json({
    path: ENV_FILE,
    username: parsed.username,
    password: parsed.password,
    updatedAt: new Date().toISOString()
  });
});

app.post("/api/env", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  const errors = validateCredentials(username, password);

  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  const content = `SQUID_USERNAME=${username}\nSQUID_PASSWORD=${password}\n`;
  try {
    fs.writeFileSync(ENV_FILE, content, "utf8");
    return res.json({
      ok: true,
      message: ".env gespeichert. Mit 'Speichern + Neustart' wird es sofort aktiv.",
      updatedAt: new Date().toISOString()
    });
  } catch {
    return res.status(500).json({ ok: false, message: ".env konnte nicht gespeichert werden." });
  }
});

app.post("/api/restart-squid", async (req, res) => {
  try {
    const result = await dockerApiRequest("POST", `/containers/${SQUID_CONTAINER_NAME}/restart?t=10`);
    if (result.statusCode >= 200 && result.statusCode < 300) {
      return res.json({
        ok: true,
        message: "squid-privoxy wurde neugestartet.",
        updatedAt: new Date().toISOString()
      });
    }

    return res.status(500).json({
      ok: false,
      message: `Restart fehlgeschlagen (HTTP ${result.statusCode}).`,
      details: result.body
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: "Restart fehlgeschlagen. Docker Socket nicht erreichbar.",
      details: String(e.message || e)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy dashboard listening on :${PORT}`);
});
