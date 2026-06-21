# Dashboard (EN)

The dashboard provides runtime visibility and configuration controls for the proxy stack.

## Access

- URL: http://127.0.0.1:8088
- Bound to loopback only.

## Start

```powershell
docker compose up -d --build
docker compose ps
```

## Features

1. Metrics
- Successful tunnels (TCP_TUNNEL/200)
- Denied 403
- Denied 407
- Other errors

2. Peer Distribution
- Parent usage from ROUNDROBIN_PARENT
- Confirms traffic distribution across both paths

3. Access Log Table
- Time, result, method, target, user, parent, duration

4. Cache Log Tail
- Latest relevant Squid events

5. IP View
- Direct IP without proxy
- Tor exit IP through proxy path

6. allowed_domains.txt Editor
- Load
- Save
- Save + Squid Restart

7. .env Editor
- Load/update SQUID_USERNAME and SQUID_PASSWORD
- Save .env
- Save .env + Squid Restart

## API

- GET /api/health
- GET /api/summary
- GET /api/access?limit=120
- GET /api/allowed-domains
- POST /api/allowed-domains
- GET /api/env
- POST /api/env
- GET /api/ip
- POST /api/restart-squid

## Notes

- Changes to allowed_domains.txt require a squid-privoxy restart.
- Changes to .env also require a restart.
- The restart button controls squid-privoxy directly from the dashboard.

## Security

- Dashboard is local-only.
- One-click restart requires Docker socket mount in the dashboard container.
- Use this only on trusted systems.

## Troubleshooting

Dashboard not reachable:

- Check docker compose ps
- Check docker compose logs --tail=200 dashboard

Saved changes are not active:

- Run restart
- Or use docker compose restart squid-privoxy

Restart from dashboard fails:

- Check dashboard logs
- Verify Docker socket mount in docker-compose.yml
