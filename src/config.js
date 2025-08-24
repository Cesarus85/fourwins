// Determine the server host used for network requests.
// `SERVER_PROTOCOL` and the backend port can be configured either via a global
// `window.SERVER_CONFIG` object or by editing the constants below. If no value
// is provided, the protocol falls back to the current page's protocol.

const DEFAULT_PROTOCOL = undefined; // e.g. 'http' or 'https'
const DEFAULT_PORT = 3000;

const PROTOCOL_OVERRIDE = window.SERVER_CONFIG?.protocol ?? DEFAULT_PROTOCOL;
const PORT_OVERRIDE = window.SERVER_CONFIG?.port ?? DEFAULT_PORT;

export const SERVER_PROTOCOL =
  PROTOCOL_OVERRIDE || (location.protocol === 'https:' ? 'https' : 'http');
export const SERVER_PORT = PORT_OVERRIDE;
export const SERVER_HOST = `${SERVER_PROTOCOL}://${location.hostname}:${SERVER_PORT}`;
