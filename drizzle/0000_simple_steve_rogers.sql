CREATE TABLE IF NOT EXISTS "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_dome" text NOT NULL,
	"section" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text NOT NULL,
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"num_dome" text NOT NULL,
	"id_employe" text NOT NULL,
	"telephone" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_num_dome_unique" UNIQUE("num_dome")
);
