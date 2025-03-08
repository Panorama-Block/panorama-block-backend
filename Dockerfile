# ----------------------------------------------------
# 1) Build Stage
# ----------------------------------------------------
FROM golang:1.23 AS builder

# Ensure we build a fully static binary
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

WORKDIR /app

# Copy go.mod and go.sum first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy all source code
COPY . .

# Build the Go binary (assuming cmd/main.go is your entry point)
RUN go build -o /app/rango-backend ./cmd/main.go

# ----------------------------------------------------
# 2) Production Stage
# ----------------------------------------------------
FROM alpine:3.18

WORKDIR /app

# Copy the statically-linked binary from the builder stage
COPY --from=builder /app/rango-backend /app/rango-backend

# Expose your server port
EXPOSE 3000

# Environment variables (populated at runtime by Docker Compose)

ENV MONGO_URI=$MONGO_URI
ENV PORT=$PORT
ENV REDIS_HOST=$REDIS_HOST
ENV REDIS_PORT=$REDIS_PORT
ENV REDIS_PASS=$REDIS_PASS

# Start the application
CMD ["/app/rango-backend"]
