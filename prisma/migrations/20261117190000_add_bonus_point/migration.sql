-- AlterTable
ALTER TABLE "Week" ADD COLUMN     "bonusAnswer" TEXT,
ADD COLUMN     "bonusBlurb" TEXT,
ADD COLUMN     "bonusEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bonusHeading" TEXT,
ADD COLUMN     "bonusImageUrl" TEXT,
ADD COLUMN     "bonusRevealed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BonusGuess" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "guess" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusGuess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonusGuess_weekId_playerId_key" ON "BonusGuess"("weekId", "playerId");

-- AddForeignKey
ALTER TABLE "BonusGuess" ADD CONSTRAINT "BonusGuess_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusGuess" ADD CONSTRAINT "BonusGuess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
