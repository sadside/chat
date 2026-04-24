FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY . .
RUN go mod tidy && go build -o app .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /src/app .
EXPOSE 8080
CMD ["./app"]
