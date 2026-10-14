CREATE TABLE "mail"."settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail"."stamp_movements" ADD COLUMN "for_date" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "mail"."stamp_movements" ADD COLUMN "note" text;