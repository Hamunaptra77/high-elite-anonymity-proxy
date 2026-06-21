function fmtDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function resultClass(result) {
  if (result === "TCP_TUNNEL/200") return "result-200";
  if (result === "TCP_DENIED/403" || result === "TCP_DENIED/407") return "result-403";
  return "result-error";
}

function renderPeers(peerUsage) {
  const box = document.getElementById("peerUsage");
  box.innerHTML = "";

  const peers = Object.entries(peerUsage || {});
  if (!peers.length) {
    box.textContent = "Noch keine Round-Robin Daten vorhanden.";
    return;
  }

  const max = Math.max(...peers.map(([, count]) => count));

  peers
    .sort((a, b) => b[1] - a[1])
    .forEach(([peer, count]) => {
      const row = document.createElement("div");
      row.className = "peer";

      const label = document.createElement("div");
      label.textContent = peer;

      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("span");
      fill.style.width = `${Math.max(4, (count / max) * 100)}%`;
      bar.appendChild(fill);

      const value = document.createElement("div");
      value.textContent = String(count);

      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(value);
      box.appendChild(row);
    });
}

function renderRows(rows) {
  const tbody = document.getElementById("accessRows");
  tbody.innerHTML = "";

  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(r.timestamp)}</td>
      <td class="${resultClass(r.result)}">${r.result}</td>
      <td>${r.method}</td>
      <td>${r.target}</td>
      <td>${r.username}</td>
      <td>${r.hierarchyPeer}</td>
      <td>${r.durationMs}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadAllowedDomains() {
  const statusEl = document.getElementById("editorStatus");
  const editorEl = document.getElementById("allowedDomainsEditor");
  statusEl.textContent = "Lade...";

  try {
    const res = await fetch("/api/allowed-domains");
    const data = await res.json();
    editorEl.value = data.content || "";
    statusEl.textContent = `Geladen (${data.count} Domains)`;
  } catch (e) {
    statusEl.textContent = `Fehler beim Laden: ${e.message}`;
  }
}

async function saveAllowedDomains() {
  const statusEl = document.getElementById("editorStatus");
  const editorEl = document.getElementById("allowedDomainsEditor");
  statusEl.textContent = "Speichere...";

  try {
    const res = await fetch("/api/allowed-domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editorEl.value })
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = (data.errors || [data.message || "Unbekannter Fehler"]).join(" | ");
      statusEl.textContent = `Fehler: ${msg}`;
      return;
    }

    statusEl.textContent = "Gespeichert. Bitte squid-privoxy neu starten.";
  } catch (e) {
    statusEl.textContent = `Fehler beim Speichern: ${e.message}`;
  }
}

async function restartSquid() {
  const statusEl = document.getElementById("editorStatus");
  statusEl.textContent = "Starte squid-privoxy neu...";

  try {
    const res = await fetch("/api/restart-squid", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = `Restart-Fehler: ${data.message || "Unbekannter Fehler"}`;
      return false;
    }

    statusEl.textContent = "Gespeichert und neu gestartet.";
    return true;
  } catch (e) {
    statusEl.textContent = `Restart-Fehler: ${e.message}`;
    return false;
  }
}

async function saveAndRestartAllowedDomains() {
  await saveAllowedDomains();
  const statusText = document.getElementById("editorStatus").textContent || "";
  if (statusText.startsWith("Fehler")) {
    return;
  }
  await restartSquid();
}

async function loadEnvSettings() {
  const statusEl = document.getElementById("envStatus");
  statusEl.textContent = "Lade...";
  try {
    const res = await fetch("/api/env");
    const data = await res.json();
    document.getElementById("envUsername").value = data.username || "";
    document.getElementById("envPassword").value = data.password || "";
    statusEl.textContent = ".env geladen";
  } catch (e) {
    statusEl.textContent = `Fehler beim Laden: ${e.message}`;
  }
}

async function saveEnvSettings() {
  const statusEl = document.getElementById("envStatus");
  statusEl.textContent = "Speichere...";

  const username = document.getElementById("envUsername").value;
  const password = document.getElementById("envPassword").value;

  try {
    const res = await fetch("/api/env", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data.errors || [data.message || "Unbekannter Fehler"]).join(" | ");
      statusEl.textContent = `Fehler: ${msg}`;
      return false;
    }
    statusEl.textContent = ".env gespeichert";
    return true;
  } catch (e) {
    statusEl.textContent = `Fehler beim Speichern: ${e.message}`;
    return false;
  }
}

async function saveAndRestartEnvSettings() {
  const ok = await saveEnvSettings();
  if (!ok) {
    return;
  }

  const restarted = await restartSquid();
  if (restarted) {
    document.getElementById("envStatus").textContent = ".env gespeichert und Squid neugestartet";
  }
}

async function refresh() {
  try {
    const [summaryRes, accessRes, ipRes] = await Promise.all([
      fetch("/api/summary"),
      fetch("/api/access?limit=120"),
      fetch("/api/ip")
    ]);

    const summary = await summaryRes.json();
    const access = await accessRes.json();
    const ipInfo = await ipRes.json();

    document.getElementById("tunnel200").textContent = summary.tunnel200;
    document.getElementById("denied403").textContent = summary.denied403;
    document.getElementById("denied407").textContent = summary.denied407;
    document.getElementById("otherErrors").textContent = summary.otherErrors;
    document.getElementById("directIp").textContent = ipInfo.directIp || "n/a";
    document.getElementById("proxyExitIp").textContent = ipInfo.proxyExitIp || "n/a";
    document.getElementById("cacheTail").textContent = (summary.cacheTail || []).join("\n") || "Keine Daten";
    document.getElementById("lastUpdate").textContent = `Update: ${new Date(summary.updatedAt).toLocaleString()}`;

    renderPeers(summary.peerUsage);
    renderRows(access.rows || []);
  } catch (e) {
    document.getElementById("lastUpdate").textContent = `Fehler beim Laden: ${e.message}`;
  }
}

refresh();
setInterval(refresh, 5000);

document.getElementById("reloadDomainsBtn").addEventListener("click", loadAllowedDomains);
document.getElementById("saveDomainsBtn").addEventListener("click", saveAllowedDomains);
document.getElementById("saveRestartDomainsBtn").addEventListener("click", saveAndRestartAllowedDomains);
document.getElementById("reloadEnvBtn").addEventListener("click", loadEnvSettings);
document.getElementById("saveEnvBtn").addEventListener("click", saveEnvSettings);
document.getElementById("saveRestartEnvBtn").addEventListener("click", saveAndRestartEnvSettings);
loadAllowedDomains();
loadEnvSettings();
