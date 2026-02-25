-- Migration: add_google_calendar_fields
-- Adds Google OAuth fields to User, googleEventId to Appointment,
-- and creates the GoogleCalendarWatch table.
-- These are all purely additive changes — no existing data is altered.

-- Add Google OAuth columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "googleId"              TEXT,
  ADD COLUMN IF NOT EXISTS "googleAccessToken"     TEXT,
  ADD COLUMN IF NOT EXISTS "googleRefreshToken"    TEXT,
  ADD COLUMN IF NOT EXISTS "googleCalendarId"      TEXT,
  ADD COLUMN IF NOT EXISTS "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "googleTokenExpiresAt"  TIMESTAMP(3);

-- Add unique index on googleId (only if not already present)
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");

-- Add googleEventId to appointments table
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;

-- Create GoogleCalendarWatch table
CREATE TABLE IF NOT EXISTS "google_calendar_watches" (
  "id"          TEXT NOT NULL,
  "channelId"   TEXT NOT NULL,
  "resourceId"  TEXT,
  "expiration"  TIMESTAMP(3) NOT NULL,
  "userId"      TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "google_calendar_watches_pkey" PRIMARY KEY ("id")
);

-- Unique indexes for GoogleCalendarWatch
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_watches_channelId_key"
  ON "google_calendar_watches"("channelId");

CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_watches_userId_key"
  ON "google_calendar_watches"("userId");

-- Foreign key: GoogleCalendarWatch.userId -> users.id (CASCADE delete)
ALTER TABLE "google_calendar_watches"
  ADD CONSTRAINT "google_calendar_watches_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
