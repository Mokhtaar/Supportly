/*
  Warnings:

  - You are about to drop the column `chat_widget_config` on the `agents` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `agents` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `agents` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp_number` on the `agents` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `knowledge_base` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `knowledge_base` table. All the data in the column will be lost.
  - Added the required column `client_id` to the `agents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by_id` to the `agents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original_name` to the `knowledge_base` table without a default value. This is not possible if the table is not empty.
  - Added the required column `client_id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Channel" ADD VALUE 'TELEGRAM';
ALTER TYPE "Channel" ADD VALUE 'API';

-- DropForeignKey
ALTER TABLE "agents" DROP CONSTRAINT "agents_user_id_fkey";

-- DropIndex
DROP INDEX "agents_user_id_idx";

-- DropIndex
DROP INDEX "agents_whatsapp_number_idx";

-- DropIndex
DROP INDEX "chat_history_channel_idx";

-- AlterTable
ALTER TABLE "agents" DROP COLUMN "chat_widget_config",
DROP COLUMN "is_active",
DROP COLUMN "user_id",
DROP COLUMN "whatsapp_number",
ADD COLUMN     "client_id" TEXT NOT NULL,
ADD COLUMN     "created_by_id" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "name" DROP DEFAULT,
ALTER COLUMN "tone" DROP DEFAULT,
ALTER COLUMN "instructions" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_history" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "knowledge_base" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "original_name" TEXT NOT NULL,
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "client_id" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxAgents" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clients_subdomain_key" ON "clients"("subdomain");

-- CreateIndex
CREATE INDEX "agents_client_id_idx" ON "agents"("client_id");

-- CreateIndex
CREATE INDEX "agents_created_by_id_idx" ON "agents"("created_by_id");

-- CreateIndex
CREATE INDEX "users_client_id_idx" ON "users"("client_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
