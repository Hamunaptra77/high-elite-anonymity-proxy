# Dashboard (DE)

Das Dashboard stellt Betriebsdaten und Konfigurationsfunktionen fuer den Proxy-Stack bereit.

## Zugriff

- URL: http://127.0.0.1:8088
- Der Port ist auf 127.0.0.1 gebunden.

## Start

```powershell
docker compose up -d --build
docker compose ps
```

## Funktionen

1. Kennzahlen
- Erfolgreiche Tunnels (TCP_TUNNEL/200)
- Denied 403
- Denied 407
- Sonstige Fehler

2. Peer-Verteilung
- Parent-Nutzung aus ROUNDROBIN_PARENT
- Sichtbarer Nachweis fuer Lastverteilung auf beide Pfade

3. Access-Log Tabelle
- Zeit, Result, Methode, Ziel, User, Parent, Dauer

4. Cache-Log Tail
- Letzte relevante Squid-Ereignisse

5. IP-Anzeige
- Direkte IP ohne Proxy
- Tor Exit IP ueber Proxy-Pfad

6. Editor fuer allowed_domains.txt
- Laden
- Speichern
- Speichern + Squid Neustart

7. Editor fuer .env
- SQUID_USERNAME und SQUID_PASSWORD laden/aendern
- .env speichern
- .env speichern + Squid Neustart

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

## Hinweise

- Aenderungen an allowed_domains.txt werden erst nach Neustart wirksam.
- Aenderungen in .env werden ebenfalls erst nach Neustart wirksam.
- Der Neustart-Button im Dashboard steuert den Dienst squid-privoxy direkt.

## Sicherheit

- Dashboard ist nur lokal erreichbar.
- Fuer den Ein-Klick-Neustart ist der Docker-Socket in den Dashboard-Container gemountet.
- Diese Funktion nur auf vertrauenswuerdigen Systemen einsetzen.

## Fehlerbehebung

Dashboard nicht erreichbar:

- docker compose ps pruefen
- docker compose logs --tail=200 dashboard

Aenderung gespeichert, aber nicht aktiv:

- Neustart ausfuehren
- Alternativ: docker compose restart squid-privoxy

Neustart aus Dashboard schlaegt fehl:

- docker compose logs --tail=200 dashboard
- docker-compose.yml auf Docker-Socket-Mount pruefen
