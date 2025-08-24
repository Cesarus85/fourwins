// Determine the server host used for network requests.
// Use same protocol and port as the current page for seamless deployment
export const SERVER_PROTOCOL = location.protocol === 'https:' ? 'https' : 'http';
export const SERVER_HOST = `${SERVER_PROTOCOL}://${location.hostname}${location.port ? ':' + location.port : ''}`;
