-- Enable pg_trgm extension for substring and wildcard ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create Trigram GIN indexes for fast ILIKE substring search in admin users list
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_username_trgm_idx" ON "users" USING gin ("username" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_display_name_trgm_idx" ON "users" USING gin ("displayName" gin_trgm_ops);
