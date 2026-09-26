FROM livekit/livekit-server:latest

COPY apps/livekit/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7880

ENTRYPOINT ["/entrypoint.sh"]
