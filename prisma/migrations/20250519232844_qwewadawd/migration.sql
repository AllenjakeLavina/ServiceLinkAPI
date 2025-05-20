/*
  Warnings:

  - You are about to drop the column `paymentProofImage` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `review` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payment` DROP COLUMN `paymentProofImage`,
    ADD COLUMN `paymentProofUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `review` DROP COLUMN `images`,
    ADD COLUMN `imageUrls` TEXT NULL;
