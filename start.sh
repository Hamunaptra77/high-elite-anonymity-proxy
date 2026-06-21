#!/bin/sh
set -eu

# Runtime-Override erlauben: Dashboard kann /etc/squid/runtime.env aendern.
if [ -f /etc/squid/runtime.env ]; then
	set -a
	. /etc/squid/runtime.env
	set +a
fi

if [ -z "${SQUID_USERNAME:-}" ] || [ -z "${SQUID_PASSWORD:-}" ]; then
	echo "Fehler: SQUID_USERNAME und SQUID_PASSWORD muessen gesetzt sein." >&2
	exit 1
fi

if [ "${SQUID_USERNAME}" = "change-me" ] || [ "${SQUID_PASSWORD}" = "change-me" ]; then
	echo "Fehler: Standardwerte erkannt. Bitte sichere Werte fuer SQUID_USERNAME/SQUID_PASSWORD setzen." >&2
	exit 1
fi

# NCSA-Datei fuer Squid Basic Auth erzeugen/aktualisieren
htpasswd -bc /etc/squid/passwd "$SQUID_USERNAME" "$SQUID_PASSWORD"

# Log-Verzeichnis fuer Squid auf Shared-Volume vorbereiten
mkdir -p /var/log/squid
chown -R proxy:proxy /var/log/squid || true

# Tor DataDirectories vorbereiten
mkdir -p /var/lib/tor /var/lib/tor2

# Zwei Tor-Instanzen als unprivilegierter User starten
echo "Starte Tor-Service 1..."
su -s /bin/sh -c 'tor -f /etc/tor/torrc' debian-tor &
echo "Starte Tor-Service 2..."
su -s /bin/sh -c 'tor -f /etc/tor/torrc2' debian-tor &

# Kurz warten, bis beide Tor SOCKS5-Ports verfuegbar sind
sleep 4

# Zwei Privoxy-Instanzen starten (je eigener Tor-Weg)
echo "Starte Privoxy-Service 1..."
privoxy --no-daemon /etc/privoxy/config &
echo "Starte Privoxy-Service 2..."
privoxy --no-daemon /etc/privoxy/config2 &

# Warten, bis beide Privoxy-Instanzen verfuegbar sind
sleep 2

# Squid als PID 1 im Vordergrund starten
echo "Starte Squid-Service..."
exec squid -N -f /etc/squid/squid.conf
