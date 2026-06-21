# Squid + Privoxy + Tor (Dual Path)

Lokaler, authentifizierter HTTP/HTTPS-Proxy mit zwei getrennten Privoxy- und Tor-Pfaden.
Der eingehende Traffic wird in Squid per Round-Robin auf beide Upstreams verteilt.

## Sprache

- Deutsch: README_DE.md
- English: README_EN.md

## Dokumente

- INSTALL_DE.md / INSTALL_EN.md: Installation, Start, Tests, Fehlerbehebung
- VERBINDUNG_DE.md / VERBINDUNG_EN.md: Verbindungsmodell und Datenfluss
- DASHBOARD_DE.md / DASHBOARD_EN.md: Dashboard-Funktionen und API

## Kurzueberblick

- Proxy Endpoint: 127.0.0.1:3128
- Auth: Basic Auth ueber SQUID_USERNAME und SQUID_PASSWORD
- Ziel-Whitelist: squid/allowed_domains.txt
- Upstream A: Squid -> Privoxy 127.0.0.1:8118 -> Tor 127.0.0.1:9050
- Upstream B: Squid -> Privoxy 127.0.0.2:8128 -> Tor 127.0.0.1:9060

## Schnellstart

```powershell
Copy-Item .env.example .env
# .env bearbeiten und SQUID_USERNAME / SQUID_PASSWORD setzen
docker compose up -d --build
docker compose ps
```

Schnelltest:

```powershell
curl.exe -x http://SQUID_USERNAME:SQUID_PASSWORD@127.0.0.1:3128 https://duckduckgo.com -I
```

## Dashboard

- URL: http://127.0.0.1:8088
- Live-Metriken aus Squid-Logs
- Peer-Verteilung fuer ROUNDROBIN_PARENT
- Editor fuer squid/allowed_domains.txt
- Editor fuer .env (SQUID_USERNAME, SQUID_PASSWORD)
- Ein-Klick-Neustart fuer Dienst squid-privoxy

## Sicherheit

- Host-Bind nur auf Loopback: 127.0.0.1:3128 und 127.0.0.1:8088
- no-new-privileges aktiv
- Capabilities minimal (SETUID/SETGID)
- Privoxy und Tor lauschen nur intern

## Hinweise

- Dieses Setup verbessert Privatsphaere, ersetzt aber keine vollstaendige OpSec-Strategie.
- Browser-Leaks (z. B. WebRTC/Fingerprinting) muessen im Browser selbst gehaertet werden.

