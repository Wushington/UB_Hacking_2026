ALTER TABLE "explanation_feedback" ADD COLUMN "mastered_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD COLUMN "self_rating" smallint;--> statement-breakpoint
ALTER TABLE "weak_concepts" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD CONSTRAINT "explanation_feedback_self_rating_range" CHECK ("explanation_feedback"."self_rating" between 1 and 5);