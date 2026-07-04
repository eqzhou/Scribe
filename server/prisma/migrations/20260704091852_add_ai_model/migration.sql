-- CreateTable
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "modelId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIModel_userId_idx" ON "AIModel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_userId_name_key" ON "AIModel"("userId", "name");

-- AddForeignKey
ALTER TABLE "AIModel" ADD CONSTRAINT "AIModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
