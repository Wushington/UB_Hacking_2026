CREATE TABLE "subject_dividers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "divider_id" uuid;--> statement-breakpoint
ALTER TABLE "subject_dividers" ADD CONSTRAINT "subject_dividers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subject_dividers_user_id_index" ON "subject_dividers" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_divider_id_subject_dividers_id_fk" FOREIGN KEY ("divider_id") REFERENCES "public"."subject_dividers"("id") ON DELETE set null ON UPDATE no action;