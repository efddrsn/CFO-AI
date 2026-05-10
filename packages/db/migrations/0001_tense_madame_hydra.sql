ALTER TABLE "integration_credentials" ALTER COLUMN "encrypted_token" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD COLUMN "scopes" text;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD COLUMN "sync_cursor" text;