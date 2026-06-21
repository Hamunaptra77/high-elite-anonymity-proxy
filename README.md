# Squid + Privoxy + Tor (Dual Path)

Local authenticated HTTP/HTTPS proxy stack with two isolated Privoxy and Tor paths.
Incoming traffic is distributed by Squid using round-robin parent selection.

## Language

- English: README_EN.md
- Deutsch: README_DE.md

## Documents

- INSTALL_EN.md / INSTALL_DE.md: Installation, startup, tests, troubleshooting
- VERBINDUNG_EN.md / VERBINDUNG_DE.md: Connection model and data flow
- DASHBOARD_EN.md / DASHBOARD_DE.md: Dashboard features and API

## Quick Overview

- Proxy endpoint: 127.0.0.1:3128
- Auth: Basic Auth via SQUID_USERNAME and SQUID_PASSWORD
- Target whitelist: squid/allowed_domains.txt
- Upstream A: Squid -> Privoxy 127.0.0.1:8118 -> Tor 127.0.0.1:9050
- Upstream B: Squid -> Privoxy 127.0.0.2:8128 -> Tor 127.0.0.1:9060

## Quick Start

```powershell
Copy-Item .env.example .env
# Edit .env and set SQUID_USERNAME / SQUID_PASSWORD
docker compose up -d --build
docker compose ps
```

Quick proxy test:

```powershell
curl.exe -x http://SQUID_USERNAME:SQUID_PASSWORD@127.0.0.1:3128 https://duckduckgo.com -I
```

## Dashboard

- URL: http://127.0.0.1:8088
- Live metrics from Squid logs
- Peer usage view for ROUNDROBIN_PARENT
- Editor for squid/allowed_domains.txt
- Editor for .env (SQUID_USERNAME, SQUID_PASSWORD)
- One-click restart for squid-privoxy service

## Security

- Host bind only on loopback: 127.0.0.1:3128 and 127.0.0.1:8088
- no-new-privileges enabled
- Minimal capabilities (SETUID/SETGID)
- Privoxy and Tor listen internally only

## Notes

- This setup improves privacy but is not full operational security.
- Browser leaks (for example WebRTC/fingerprinting) must be hardened in the client.
