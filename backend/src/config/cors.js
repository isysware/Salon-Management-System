export const isAllowedOrigin = (origin, configuredOrigins, isDevelopment) => {
  if (!origin) return true; // Non-browser clients do not send an Origin header.
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
  if (configuredOrigins.includes('*')) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (parsed.hostname.endsWith('.vercel.app')) return true;
  return isDevelopment && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
};
