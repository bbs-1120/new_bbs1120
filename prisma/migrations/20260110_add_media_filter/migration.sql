-- AlterTable: Add media_filter column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "media_filter" TEXT;

-- AlterTable: Add media_filter column to invites table
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "media_filter" TEXT;
