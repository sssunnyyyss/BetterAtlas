# Enriched Course Embeddings Design

## Overview

Enrich the existing course embeddings to include instructor data, aggregate ratings, enrollment stats, and LLM-generated review summaries. This transforms the embeddings from catalog-only text into a full picture of the student experience, dramatically improving semantic search quality for the AI recommendation system.

## Current State

The `course_embeddings` table exists with pgvector (`vector(1536)`) using `text-embedding-3-small`. The current embedding text only includes: code, title, department, GER codes, campus, prerequisites, requirements, and description — all catalog metadata, no student experience data.

## Changes

### 1. New Table: `course_review_summaries`

```sql
CREATE TABLE course_review_summaries (
  course_id    INTEGER PRIMARY KEY REFERENCES courses(id),
  summary      TEXT NOT NULL,
  review_count INTEGER NOT NULL,
  review_hash  VARCHAR(64) NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `summary`: 2-4 sentence LLM-generated summary of student reviews
- `review_count`: number of reviews that were summarized
- `review_hash`: SHA256 of concatenated review texts (skip re-summarization when unchanged)

### 2. Enriched Embedding Text

The `embeddingTextFromCourse` function will produce richer text:

```
Code: CS 170
Title: Introduction to Algorithms
Department: CS
Credits: 4
GER: QR2
Campus: Atlanta
Prerequisites: MATH 111, CS 171
Instructors: Dr. Smith (quality 4.5/5), Dr. Jones (quality 3.8/5)
Ratings: 4.2/5 quality, 3.6/5 difficulty, 7.8/10 workload, 45 reviews
Enrollment: 92% average enrollment
Description: This course covers fundamental algorithm design...
Student Feedback: Students praise the engaging lectures and well-structured
problem sets. The course is considered challenging but fair. Common advice
is to attend office hours regularly.
```

New attributes added to embedding text:
- **Instructor names + per-instructor quality ratings** (from `course_instructor_ratings`)
- **Aggregate ratings** with labels (quality, difficulty, workload, review count)
- **Credits** as a number
- **Average enrollment percentage** (from sections)
- **Student Feedback** — LLM-generated review summary from `course_review_summaries`

### 3. Two-Phase Backfill Pipeline

The `pnpm embeddings:backfill` command runs two sequential phases:

**Phase 1: Review Summarization**
1. Load all courses that have reviews
2. For each course, load up to 20 most recent reviews
3. Hash review texts — skip if hash matches `course_review_summaries.review_hash`
4. Send to OpenAI chat API (gpt-4o-mini) with summarization prompt
5. Upsert into `course_review_summaries`

Summarization prompt: "Summarize student feedback for this course in 2-4 sentences. Cover teaching quality, difficulty, workload, and common praise or complaints. Be specific and factual."

**Phase 2: Embedding Generation** (existing job, enhanced)
1. Load all courses with ratings, instructors, and review summaries (joined)
2. Build enriched embedding text
3. Hash text — skip if unchanged (`course_embeddings.content_hash`)
4. Batch embed via `text-embedding-3-small`
5. Upsert into `course_embeddings`

### 4. No Changes to Search or AI Route

The semantic search (`semanticSearchCoursesByEmbedding`) and the AI route (`/ai/course-recommendations`) require no changes. They already use the embeddings — we're just making the embeddings better. The cosine similarity search will automatically return more relevant results because the vectors now encode richer information.

## Cost Estimate (~500 courses)

- Phase 1 (summarization): ~$0.05-0.10 (gpt-4o-mini)
- Phase 2 (embedding): ~$0.01 (text-embedding-3-small)
- Total: ~$0.10 per full backfill
- Incremental runs only process changed courses

## Scope

### In scope
- New `course_review_summaries` table + migration
- Review summarization job (Phase 1)
- Enriched `embeddingTextFromCourse` function (Phase 2)
- Updated backfill job combining both phases
- Drizzle schema for new table

### Out of scope
- Changing the embedding model or dimensions
- Multi-vector approaches
- Real-time embedding updates (still batch job)
- Changes to the AI route or semantic search logic
- Frontend changes
