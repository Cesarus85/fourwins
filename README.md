# Four Wins

Simple Connect Four game with network play.

## Server Configuration

Network requests use constants defined in `src/config.js`.

- `SERVER_PROTOCOL` – either `http` or `https`. It defaults to the protocol used
  by the page (`location.protocol`).
- `SERVER_HOST` – base URL of the backend, combining protocol, host and port.

### Deployment

When deploying locally without TLS, `SERVER_PROTOCOL` resolves to `http` and the
client connects via `ws://` for WebSockets. For secure deployments served over
HTTPS, the protocol becomes `https` and WebSockets use `wss://` automatically.

If your deployment requires a specific protocol regardless of the page's
protocol, adjust `SERVER_PROTOCOL` in `src/config.js` accordingly before
building the frontend.
