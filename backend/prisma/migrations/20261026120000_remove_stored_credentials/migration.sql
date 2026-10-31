-- Keep the nullable legacy column compatible with existing Prisma clients,
-- but erase its contents and prevent passwords from being stored there again.
UPDATE "User" SET "plainPassword" = NULL WHERE "plainPassword" IS NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_plainPassword_must_be_null" CHECK ("plainPassword" IS NULL);

-- Clean historical snapshots as well as protecting new writes in the application.
CREATE FUNCTION salonos_redact_credentials(value jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  IF jsonb_typeof(value) = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(key, salonos_redact_credentials(val)), '{}'::jsonb)
      INTO result FROM jsonb_each(value) AS entry(key, val)
      WHERE lower(key) NOT IN ('password', 'plainpassword', 'passwordhash', 'oldpassword', 'newpassword',
        'temporarypassword', 'token', 'tokenhash', 'refreshtoken', 'accesstoken', 'communicationkey');
    RETURN result;
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(salonos_redact_credentials(val) ORDER BY ord), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(val, ord);
    RETURN result;
  END IF;
  RETURN value;
END;
$$;
UPDATE "AuditEvent" SET "before" = salonos_redact_credentials("before"), "after" = salonos_redact_credentials("after")
WHERE "before" IS NOT NULL OR "after" IS NOT NULL;
DROP FUNCTION salonos_redact_credentials(jsonb);
