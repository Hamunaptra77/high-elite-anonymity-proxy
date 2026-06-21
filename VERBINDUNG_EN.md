# Connection Model (EN)

Incoming traffic goes through Squid and is distributed across two isolated Privoxy/Tor paths.

## Components

- Squid: 127.0.0.1:3128 (local bind only)
- Privoxy 1: 127.0.0.1:8118
- Privoxy 2: 127.0.0.2:8128
- Tor 1 SOCKS: 127.0.0.1:9050
- Tor 2 SOCKS: 127.0.0.1:9060

## Data Flow

Path A:

Client -> Squid -> Privoxy1 -> Tor1 -> Internet

Path B:

Client -> Squid -> Privoxy2 -> Tor2 -> Internet

Squid uses ROUNDROBIN_PARENT to distribute requests between both parents.

## Relevant Configuration Files

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

## Verify Distribution

```powershell
docker exec -u proxy squid-privoxy sh -lc "grep 'TCP_TUNNEL/200' /var/log/squid/access.log | grep 'ROUNDROBIN_PARENT/' | tail -n 20 | sed -E 's/.*ROUNDROBIN_PARENT\///' | sed -E 's/ .*$//' | sort | uniq -c | sort -nr"
```

Typical output:

- 10 127.0.0.1
- 10 127.0.0.2

## Security Limits

- Target systems see Tor exit IPs instead of your direct connection IP.
- Your ISP can still detect Tor usage patterns.
- Browser leaks (WebRTC/WebGL/fingerprinting) must be hardened on the client side.
