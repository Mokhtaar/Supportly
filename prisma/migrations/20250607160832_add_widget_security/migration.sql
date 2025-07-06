/*
  Warnings:

  - A unique constraint covering the columns `[widget_key]` on the table `agents` will be added. If there are existing duplicate values, this will fail.
  - The required column `widget_key` was added to the `agents` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "allowed_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "whatsapp_number" TEXT,
ADD COLUMN     "widget_key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agents_widget_key_key" ON "agents"("widget_key");
