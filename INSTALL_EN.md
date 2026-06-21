# Installation (EN)

This guide sets up the project on Windows using PowerShell and Docker Desktop.

## 1. Requirements

- Docker Desktop is running
- PowerShell with docker compose available
- Project folder is opened

## 2. Create .env

```powershell
Copy-Item .env.example .env
```

Example content:

```env
SQUID_USERNAME=testuser
SQUID_PASSWORD=testpassword
```

## 3. Build and Start

```powershell
docker compose up -d --build
docker compose ps
```

Expected:

- squid-privoxy service is Up/healthy
- dashboard service is Up

## 4. Functional Test

Allowed domain (expected 200):

```powershell
curl.exe -sS -o NUL -w "allowed=%{http_code}`n" -x http://SQUID_USERNAME:SQUID_PASSWORD@127.0.0.1:3128 https://duckduckgo.com
```

Blocked domain (expected 403):

```powershell
curl.exe -sS -o NUL -w "blocked=%{http_code}`n" -x http://SQUID_USERNAME:SQUID_PASSWORD@127.0.0.1:3128 https://example.org
```

No auth (expected 407):

```powershell
curl.exe -sS -o NUL -w "auth_missing=%{http_code}`n" -x http://127.0.0.1:3128 https://duckduckgo.com
```

## 5. Logs and Diagnostics

```powershell
docker compose logs --tail=200 squid-privoxy
docker compose logs --tail=200 dashboard
```

Access log inside container:

```powershell
docker exec -u proxy squid-privoxy sh -lc "tail -n 80 /var/log/squid/access.log"
```

## 6. Dashboard Check

- URL: http://127.0.0.1:8088

```powershell
curl.exe -sS http://127.0.0.1:8088/api/health
curl.exe -sS http://127.0.0.1:8088/api/summary
```

## 7. Stop and Restart

```powershell
docker compose restart squid-privoxy
docker compose down
```

## 8. Common Issues

Port 3128 is already in use:

- Stop the conflicting process or container
- Run docker compose up -d --build again

403 for an allowed domain:

- Check squid/allowed_domains.txt
- Restart squid-privoxy

Restart from dashboard fails:

- Check Docker socket mount in docker-compose.yml
- Check dashboard logs
