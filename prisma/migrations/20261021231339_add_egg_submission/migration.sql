-- CreateTable
CREATE TABLE "EggSubmission" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EggSubmission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EggSubmission" ADD CONSTRAINT "EggSubmission_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EggSubmission" ADD CONSTRAINT "EggSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
