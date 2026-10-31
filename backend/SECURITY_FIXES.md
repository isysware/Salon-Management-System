# Authentication and audit fixes

The API no longer stores or returns existing plaintext user passwords. Authorized
administrators can still reset passwords; the new password is returned by that
reset operation only. Password hashes and login credentials continue to work.
Audit snapshots are recursively scrubbed on writes and reads, including historical
records returned before database cleanup is deployed.

Email delivery is not configured. The recovery endpoint now gives consistent
administrator-assisted recovery instructions without generating tokens, revealing
account existence, or claiming an email was delivered. SMTP delivery remains a
separate integration requiring provider configuration and a reset-link UI.

## Deployment

1. Set `CORS_ORIGIN` to exact trusted frontend origins, comma-separated. Wildcards
   and automatic access for arbitrary Vercel deployments are no longer supported.
   Development mode allows localhost, 127.0.0.1 and IPv6 loopback.
2. Deploy the updated backend, then run `npm run db:deploy` against the intended
   database. The new migration clears legacy plaintext password values, enforces
   null values for the legacy column, and scrubs historical audit JSON. It does not
   change password hashes. The column remains for Prisma client compatibility.
3. Deploy the frontend to remove existing-password display controls and show the
   recovery guidance.

The checked-in environment example previously contained database credentials.
It now uses placeholders. Rotate any real credentials previously published in
that file through the database provider; editing the example does not revoke them
or remove them from Git history. No live credentials were rotated by this change.

The obfuscated executable appended to `vitest.config.js` and its injected
`createRequire` setup were removed without executing the payload. This is a source
cleanup, not confirmation that the machine was never affected by an earlier run.

## Verification

`node node_modules/vitest/vitest.mjs run --config vitest.security.config.js`
runs database-independent regression tests, including existing admin-assignment
coverage. `npm run lint` in the frontend checks TypeScript. Full integration tests
require a dedicated `.env.test` database; never point the reset-based test setup
at the live database.
