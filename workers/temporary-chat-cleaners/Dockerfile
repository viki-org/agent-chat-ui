FROM alpine:latest
RUN apk add bash curl jq
COPY run.sh /app
WORKDIR /app
CMD ["exec", "./run.sh"]
