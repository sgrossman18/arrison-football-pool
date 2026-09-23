-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startTime" TIMESTAMP(3);

-- Preserve today's on-screen order for existing games: number each week's games
-- by kickoff (ties broken by id, i.e. creation order).
UPDATE "Game" g
SET "sortOrder" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "weekId" ORDER BY "kickoff" ASC, id ASC) AS rn
  FROM "Game"
) sub
WHERE g.id = sub.id;
