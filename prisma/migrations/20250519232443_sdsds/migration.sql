/*
  Warnings:

  - You are about to drop the column `proofImageUrl` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `proofImageUrl` on the `review` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payment` DROP COLUMN `proofImageUrl`,
    ADD COLUMN `paymentProofImage` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `review` DROP COLUMN `proofImageUrl`,
    ADD COLUMN `images` TEXT NULL;
