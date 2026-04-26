-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'building', 'deploying', 'running', 'failed');

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
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
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
