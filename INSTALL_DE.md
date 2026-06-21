# Installation (DE)

Diese Anleitung richtet das Projekt unter Windows mit PowerShell und Docker Desktop ein.

## 1. Voraussetzungen

- Docker Desktop laeuft
- PowerShell mit docker compose verfuegbar
- Projektordner ist geoeffnet

## 2. .env anlegen

```powershell
Copy-Item .env.example .env
```

Beispielinhalt:

```env
SQUID_USERNAME=testuser
SQUID_PASSWORD=testpasswort
```

## 3. Build und Start

```powershell
docker compose up -d --build
docker compose ps
```

Erwartung:

- Dienst squid-privoxy ist Up/healthy
- Dienst dashboard ist Up

## 4. Funktionstest

Erlaubte Domain (erwartet 200):

```powershell
curl.exe -sS -o NUL -w "allowed=%{http_code}`n" -x http://SQUID_USERNAME:SQUID_PASSWORD@127.0.0.1:3128 https://duckduckgo.com
```

Nicht erlaubte Domain (erwartet 403):

```powershell
curl.exe -sS -o NUL -w "blocked=%{http_code}`n" -x http://SQUID_USERNAME:SQUID_PASSWORD@127.0.0.1:3128 https://example.org
```

Ohne Auth (erwartet 407):

```powershell
curl.exe -sS -o NUL -w "auth_missing=%{http_code}`n" -x http://127.0.0.1:3128 https://duckduckgo.com
```

## 5. Logs und Diagnose

```powershell
docker compose logs --tail=200 squid-privoxy
docker compose logs --tail=200 dashboard
```

Access-Log im Container:

```powershell
docker exec -u proxy squid-privoxy sh -lc "tail -n 80 /var/log/squid/access.log"
```

## 6. Dashboard pruefen

- URL: http://127.0.0.1:8088

```powershell
curl.exe -sS http://127.0.0.1:8088/api/health
curl.exe -sS http://127.0.0.1:8088/api/summary
```

## 7. Stop und Neustart

```powershell
docker compose restart squid-privoxy
docker compose down
```

## 8. Haeufige Probleme

Port 3128 belegt:

- Anderen Prozess oder Container stoppen
- Danach erneut docker compose up -d --build

403 trotz erlaubter Domain:

- Eintrag in squid/allowed_domains.txt pruefen
- Danach squid-privoxy neu starten

Neustart aus Dashboard funktioniert nicht:

- Docker-Socket-Mount in docker-compose.yml pruefen
- dashboard Logs kontrollieren
