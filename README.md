# Four Wins

Simple Connect Four game with network play.

## Server Configuration

Network requests use constants defined in `src/config.js`.

- `SERVER_PROTOCOL` – either `http` or `https`. It can be set via
  `window.SERVER_CONFIG.protocol` or the `DEFAULT_PROTOCOL` constant. If neither
  is provided, it falls back to the page's protocol (`location.protocol`).
- `SERVER_PORT` – backend port. Configure it through
  `window.SERVER_CONFIG.port` or the `DEFAULT_PORT` constant (defaults to `3000`).
- `SERVER_HOST` – base URL of the backend, combining protocol, host and port.

### Deployment

When deploying locally without TLS, `SERVER_PROTOCOL` will use the page's
protocol (`http`) and connect via `ws://` for WebSockets. For secure deployments
served over HTTPS, the protocol becomes `https` and WebSockets use `wss://`
automatically.

If your deployment requires a specific protocol or port regardless of the
page's settings, either define them before loading the bundle:

```html
<script>
  window.SERVER_CONFIG = { protocol: 'https', port: 443 };
</script>
```

or edit `DEFAULT_PROTOCOL` and `DEFAULT_PORT` in `src/config.js` before building
the frontend.
