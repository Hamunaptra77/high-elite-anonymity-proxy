FROM debian:12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends squid privoxy tor ca-certificates apache2-utils \
    && rm -rf /var/lib/apt/lists/*

COPY squid/squid.conf /etc/squid/squid.conf
COPY privoxy/config /etc/privoxy/config
COPY privoxy/config2 /etc/privoxy/config2
COPY tor/torrc /etc/tor/torrc
COPY tor/torrc2 /etc/tor/torrc2
COPY start.sh /usr/local/bin/start.sh

RUN chmod +x /usr/local/bin/start.sh \
    && mkdir -p /var/log/squid /var/run/squid /var/lib/tor /var/lib/tor2 /var/log/tor \
    && chown -R debian-tor:debian-tor /var/lib/tor /var/lib/tor2 /var/log/tor /etc/tor/torrc /etc/tor/torrc2

EXPOSE 3128 8118 8128 9050 9060

ENTRYPOINT ["/usr/local/bin/start.sh"]
