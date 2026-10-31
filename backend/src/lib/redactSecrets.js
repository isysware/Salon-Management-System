const secretKeys = new Set(['password', 'plainpassword', 'passwordhash', 'oldpassword', 'newpassword', 'temporarypassword', 'token', 'tokenhash', 'refreshtoken', 'accesstoken', 'communicationkey']);

// Apply both when writing new audit events and returning historical snapshots.
export const redactSecrets = (value) => {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (typeof value.toJSON === 'function') return redactSecrets(value.toJSON());
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !secretKeys.has(key.toLowerCase()))
    .map(([key, entry]) => [key, redactSecrets(entry)]));
};
