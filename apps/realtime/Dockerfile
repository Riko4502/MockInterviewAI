# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache ca-certificates git tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Compile statically with symbol and debug stripping (-s -w -trimpath)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w -extldflags '-static'" \
    -o /app/realtime-server ./cmd/server

# Ultra-lightweight and secure Distroless stage (~15 MB)
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/realtime-server /app/realtime-server

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/app/realtime-server"]
