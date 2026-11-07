CREATE TYPE "public"."lecture_status" AS ENUM('draft', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."note_block_kind" AS ENUM('paragraph', 'bullet', 'definition', 'example', 'equation');--> statement-breakpoint
CREATE TYPE "public"."recording_purpose" AS ENUM('lecture', 'explanation');--> statement-breakpoint
CREATE TYPE "public"."recording_status" AS ENUM('uploaded', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_result" AS ENUM('got_it', 'missed');--> statement-breakpoint
CREATE TYPE "public"."study_session_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."weak_concept_source_type" AS ENUM('study_review_event', 'explanation_weak_point');--> statement-breakpoint
CREATE TABLE "audio_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lecture_id" uuid,
	"purpose" "recording_purpose" NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"duration_ms" integer,
	"status" "recording_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audio_recordings_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_user_id_normalized_name_unique" UNIQUE("user_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "explanation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"transcript_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explanation_feedback_recording_id_unique" UNIQUE("recording_id")
);
--> statement-breakpoint
CREATE TABLE "explanation_weak_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"concept_key" text NOT NULL,
	"label" text NOT NULL,
	"explanation" text NOT NULL,
	"evidence" text,
	"reference_block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"requested_count" integer NOT NULL,
	"actual_count" integer NOT NULL,
	"notes_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"source_note_block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"concept_key" text NOT NULL,
	"concept_label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lecture_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecture_images_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "lectures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"status" "lecture_status" DEFAULT 'draft' NOT NULL,
	"suggested_category_name" text,
	"notes_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"kind" "note_block_kind" NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"heading" text NOT NULL,
	"position" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"flashcard_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" "review_result" NOT NULL,
	CONSTRAINT "study_review_events_session_id_flashcard_id_unique" UNIQUE("session_id","flashcard_id")
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "study_session_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"missed_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer,
	"text" text NOT NULL,
	"approximate" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weak_concept_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weak_concept_id" uuid NOT NULL,
	"source_type" "weak_concept_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weak_concept_sources_weak_concept_id_source_type_source_id_unique" UNIQUE("weak_concept_id","source_type","source_id")
);
--> statement-breakpoint
CREATE TABLE "weak_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lecture_id" uuid NOT NULL,
	"concept_key" text NOT NULL,
	"label" text NOT NULL,
	"missed_count" integer DEFAULT 0 NOT NULL,
	"feedback_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weak_concepts_user_id_lecture_id_concept_key_unique" UNIQUE("user_id","lecture_id","concept_key")
);
--> statement-breakpoint
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD CONSTRAINT "explanation_feedback_recording_id_audio_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."audio_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD CONSTRAINT "explanation_feedback_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_feedback" ADD CONSTRAINT "explanation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_weak_points" ADD CONSTRAINT "explanation_weak_points_feedback_id_explanation_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."explanation_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_flashcard_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."flashcard_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_images" ADD CONSTRAINT "lecture_images_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_images" ADD CONSTRAINT "lecture_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_blocks" ADD CONSTRAINT "note_blocks_section_id_note_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."note_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_sections" ADD CONSTRAINT "note_sections_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_review_events" ADD CONSTRAINT "study_review_events_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_review_events" ADD CONSTRAINT "study_review_events_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_review_events" ADD CONSTRAINT "study_review_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_deck_id_flashcard_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."flashcard_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_recording_id_audio_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."audio_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_concept_sources" ADD CONSTRAINT "weak_concept_sources_weak_concept_id_weak_concepts_id_fk" FOREIGN KEY ("weak_concept_id") REFERENCES "public"."weak_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_concepts" ADD CONSTRAINT "weak_concepts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_concepts" ADD CONSTRAINT "weak_concepts_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_recordings_user_id_index" ON "audio_recordings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "explanation_feedback_user_id_index" ON "explanation_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "explanation_weak_points_feedback_id_index" ON "explanation_weak_points" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "flashcard_decks_lecture_id_index" ON "flashcard_decks" USING btree ("lecture_id");--> statement-breakpoint
CREATE INDEX "flashcards_deck_id_index" ON "flashcards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "lecture_images_lecture_id_index" ON "lecture_images" USING btree ("lecture_id");--> statement-breakpoint
CREATE INDEX "lectures_user_id_index" ON "lectures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_blocks_section_id_index" ON "note_blocks" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "note_sections_lecture_id_index" ON "note_sections" USING btree ("lecture_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_id_index" ON "study_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_sessions_deck_id_index" ON "study_sessions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "transcript_segments_recording_id_index" ON "transcript_segments" USING btree ("recording_id");