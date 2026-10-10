-- Restore indexes removed by the preceding schema reconciliation migration.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING gin ("email" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_username_trgm_idx"
  ON "users" USING gin ("username" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_display_name_trgm_idx"
  ON "users" USING gin ("displayName" gin_trgm_ops);