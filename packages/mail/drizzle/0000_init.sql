CREATE SCHEMA "mail";
--> statement-breakpoint
CREATE TYPE "mail"."mail_service" AS ENUM('REGISTERED', 'ORDINARY');--> statement-breakpoint
CREATE TYPE "mail"."mailpiece_status" AS ENUM('PREPARED', 'PRINTED', 'RELEASED', 'DELIVERED', 'RETURNED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "mail"."control_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_seq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail"."mailpieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_no" varchar(40) NOT NULL,
	"control_year" integer NOT NULL,
	"control_seq" integer NOT NULL,
	"mail_date" date NOT NULL,
	"service" "mail"."mail_service" NOT NULL,
	"doc_refs" text[] NOT NULL,
	"recipient_id" uuid NOT NULL,
	"recipient_name" varchar(240) NOT NULL,
	"recipient_position" varchar(240),
	"recipient_company" varchar(240),
	"recipient_address_lines" text[] NOT NULL,
	"province" varchar(80) NOT NULL,
	"zone" varchar(40) NOT NULL,
	"weight_grams" integer NOT NULL,
	"base_rate" integer NOT NULL,
	"return_card_fee" integer NOT NULL,
	"required_postage" integer NOT NULL,
	"rate_source" varchar(120) NOT NULL,
	"stamps" jsonb NOT NULL,
	"stamps_total" integer NOT NULL,
	"status" "mail"."mailpiece_status" DEFAULT 'PREPARED' NOT NULL,
	"released_at" timestamp with time zone,
	"remail_of" uuid,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mailpieces_control_no_unique" UNIQUE("control_no")
);
--> statement-breakpoint
CREATE TABLE "mail"."recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(240) NOT NULL,
	"position" varchar(240),
	"company" varchar(240),
	"address_lines" text[] NOT NULL,
	"province" varchar(80) NOT NULL,
	"last_mile" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mail"."stamp_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"denomination" integer NOT NULL,
	"change" integer NOT NULL,
	"reason" varchar(40) NOT NULL,
	"mailpiece_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail"."stamp_stock" (
	"denomination" integer PRIMARY KEY NOT NULL,
	"available" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail"."mailpieces" ADD CONSTRAINT "mailpieces_recipient_id_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "mail"."recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail"."mailpieces" ADD CONSTRAINT "mailpieces_remail_of_mailpieces_id_fk" FOREIGN KEY ("remail_of") REFERENCES "mail"."mailpieces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail"."stamp_movements" ADD CONSTRAINT "stamp_movements_mailpiece_id_mailpieces_id_fk" FOREIGN KEY ("mailpiece_id") REFERENCES "mail"."mailpieces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mailpieces_mail_date_idx" ON "mail"."mailpieces" USING btree ("mail_date");--> statement-breakpoint
CREATE INDEX "recipients_name_idx" ON "mail"."recipients" USING btree (lower("name"));