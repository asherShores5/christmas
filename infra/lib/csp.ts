// The Content-Security-Policy CloudFront sends (hosting.ts). Plain data with no CDK imports, so a
// browser check can serve the very same policy. Everything (shell, bundle, icons, manifest,
// service worker) is served from this origin, and the site makes no requests anywhere else.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

// Turn off browser features the site never uses.
export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "bluetooth=()",
  "serial=()",
  "hid=()",
].join(", ");
