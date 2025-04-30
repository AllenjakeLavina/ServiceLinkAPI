/*
  Warnings:

  - You are about to drop the column `imageUrls` on the `portfolio` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `portfolio` DROP COLUMN `imageUrls`;

-- CreateTable
CREATE TABLE `PortfolioFile` (
    `id` VARCHAR(191) NOT NULL,
    `portfolioId` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `fileType` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PortfolioFile` ADD CONSTRAINT `PortfolioFile_portfolioId_fkey` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
