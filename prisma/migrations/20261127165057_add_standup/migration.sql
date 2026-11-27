-- CreateTable
CREATE TABLE "standup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "fait" TEXT[],
    "blocages" TEXT[],
    "prevu" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "standup_userId_jour_key" ON "standup"("userId", "jour");

-- AddForeignKey
ALTER TABLE "standup" ADD CONSTRAINT "standup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
