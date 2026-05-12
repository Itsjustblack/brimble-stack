-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'cloning', 'building', 'ready', 'deploying', 'live', 'failed', 'stopped');

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'pending',
    "imageTag" TEXT,
    "liveUrl" TEXT,
    "containerId" TEXT,
    "port" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentEnv" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentEnv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_slug_key" ON "Deployment"("slug");

-- CreateIndex
CREATE INDEX "DeploymentEnv_deploymentId_idx" ON "DeploymentEnv"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentEnv_deploymentId_key_key" ON "DeploymentEnv"("deploymentId", "key");

-- AddForeignKey
ALTER TABLE "DeploymentEnv" ADD CONSTRAINT "DeploymentEnv_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
