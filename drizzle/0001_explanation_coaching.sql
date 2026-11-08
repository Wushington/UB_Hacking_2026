ALTER TABLE "explanation_feedback" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD COLUMN "covered_ideas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD COLUMN "next_step" text;