-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('SUPERBILL', 'EOB', 'ERA', 'PAYER_CORRESPONDENCE', 'APPEAL', 'CONTRACT', 'W9', 'STATE_LICENSE', 'DEA_CERTIFICATE', 'MALPRACTICE_COI', 'BOARD_CERTIFICATE', 'DIPLOMA', 'CV', 'OTHER');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('STATE_LICENSE', 'DEA_REGISTRATION', 'CDS_REGISTRATION', 'BOARD_CERTIFICATION', 'MALPRACTICE_COVERAGE', 'CAQH_ATTESTATION', 'BLS_ACLS', 'NPDB_QUERY', 'IMMUNIZATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('NOT_STARTED', 'PREPARING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'EFFECTIVE', 'DENIED', 'REVALIDATION_DUE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_PAYER', 'WAITING_ON_CLIENT', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ArBucket" AS ENUM ('AGE_0_30', 'AGE_31_60', 'AGE_61_90', 'AGE_91_120', 'AGE_120_PLUS');

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "caqhProviderId" TEXT;

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT,
    "providerId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "replacesId" TEXT,
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialItem" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "identifier" TEXT,
    "issuingAuthority" TEXT,
    "state" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayerEnrollment" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "locationId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "revalidationDueAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "issuedProviderId" TEXT,
    "submissionReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayerEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkQueue" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "service" "ServiceLine",
    "defaultSlaDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT,
    "payerEnrollmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'NORMAL',
    "assigneeId" TEXT,
    "arBucket" "ArBucket",
    "claimRef" TEXT,
    "amountCents" INTEGER,
    "denialCode" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_replacesId_key" ON "Document"("replacesId");

-- CreateIndex
CREATE INDEX "Document_clientId_category_idx" ON "Document"("clientId", "category");

-- CreateIndex
CREATE INDEX "Document_providerId_category_idx" ON "Document"("providerId", "category");

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE INDEX "CredentialItem_providerId_type_idx" ON "CredentialItem"("providerId", "type");

-- CreateIndex
CREATE INDEX "CredentialItem_expiresAt_idx" ON "CredentialItem"("expiresAt");

-- CreateIndex
CREATE INDEX "CredentialItem_retiredAt_expiresAt_idx" ON "CredentialItem"("retiredAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PayerEnrollment_status_idx" ON "PayerEnrollment"("status");

-- CreateIndex
CREATE INDEX "PayerEnrollment_followUpAt_idx" ON "PayerEnrollment"("followUpAt");

-- CreateIndex
CREATE INDEX "PayerEnrollment_revalidationDueAt_idx" ON "PayerEnrollment"("revalidationDueAt");

-- CreateIndex
CREATE INDEX "PayerEnrollment_payerId_status_idx" ON "PayerEnrollment"("payerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayerEnrollment_providerId_payerId_locationId_key" ON "PayerEnrollment"("providerId", "payerId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkQueue_key_key" ON "WorkQueue"("key");

-- CreateIndex
CREATE INDEX "WorkItem_queueId_status_idx" ON "WorkItem"("queueId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_idx" ON "WorkItem"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_clientId_status_idx" ON "WorkItem"("clientId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_dueAt_idx" ON "WorkItem"("dueAt");

-- CreateIndex
CREATE INDEX "WorkItem_status_priority_idx" ON "WorkItem"("status", "priority");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialItem" ADD CONSTRAINT "CredentialItem_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialItem" ADD CONSTRAINT "CredentialItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerEnrollment" ADD CONSTRAINT "PayerEnrollment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerEnrollment" ADD CONSTRAINT "PayerEnrollment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerEnrollment" ADD CONSTRAINT "PayerEnrollment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "WorkQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_payerEnrollmentId_fkey" FOREIGN KEY ("payerEnrollmentId") REFERENCES "PayerEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
