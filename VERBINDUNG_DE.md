# Verbindungsmodell (DE)

Der eingehende Traffic laeuft ueber Squid und wird auf zwei getrennte Privoxy/Tor-Pfade verteilt.

## Komponenten

- Squid: 127.0.0.1:3128 (nur lokal gebunden)
- Privoxy 1: 127.0.0.1:8118
- Privoxy 2: 127.0.0.2:8128
- Tor 1 SOCKS: 127.0.0.1:9050
- Tor 2 SOCKS: 127.0.0.1:9060

## Datenfluss

Pfad A:

Client -> Squid -> Privoxy1 -> Tor1 -> Internet

Pfad B:

Client -> Squid -> Privoxy2 -> Tor2 -> Internet

Squid nutzt ROUNDROBIN_PARENT fuer die Verteilung auf beide Parents.

## Relevante Konfigurationsdateien

- squid/squid.conf
  - cache_peer 127.0.0.1 parent 8118 ... name=privoxy1
  - cache_peer 127.0.0.2 parent 8128 ... name=privoxy2

- privoxy/config
  - listen-address 127.0.0.1:8118
  - forward-socks5t / 127.0.0.1:9050 .

- privoxy/config2
  - listen-address 127.0.0.2:8128
  - forward-socks5t / 127.0.0.1:9060 .

- tor/torrc
  - SocksPort 127.0.0.1:9050

- tor/torrc2
  - SocksPort 127.0.0.1:9060

## Lastverteilung nachweisen

```powershell
docker exec -u proxy squid-privoxy sh -lc "grep 'TCP_TUNNEL/200' /var/log/squid/access.log | grep 'ROUNDROBIN_PARENT/' | tail -n 20 | sed -E 's/.*ROUNDROBIN_PARENT\///' | sed -E 's/ .*$//' | sort | uniq -c | sort -nr"
```

Typische Ausgabe:

- 10 127.0.0.1
- 10 127.0.0.2

## Sicherheitsgrenzen

- Zielsysteme sehen Tor-Exit-IPs statt direkter Anschluss-IP.
- Dein Provider kann Tor-Nutzung weiterhin erkennen.
- Browser-Leaks (WebRTC/WebGL/Fingerprinting) muessen clientseitig gehaertet werden.
