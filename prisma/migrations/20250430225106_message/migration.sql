/*
  Warnings:

  - You are about to drop the column `attachments` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `chatRoomId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the `chatroom` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `conversationId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `chatroom` DROP FOREIGN KEY `ChatRoom_serviceBookingId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_chatRoomId_fkey`;

-- DropIndex
DROP INDEX `Message_chatRoomId_fkey` ON `message`;

-- AlterTable
ALTER TABLE `message` DROP COLUMN `attachments`,
    DROP COLUMN `chatRoomId`,
    ADD COLUMN `conversationId` VARCHAR(191) NOT NULL,
    ADD COLUMN `imageUrl` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `chatroom`;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `user1Id` VARCHAR(191) NOT NULL,
    `user2Id` VARCHAR(191) NOT NULL,
    `serviceBookingId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Conversation_serviceBookingId_key`(`serviceBookingId`),
    UNIQUE INDEX `Conversation_user1Id_user2Id_key`(`user1Id`, `user2Id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_user1Id_fkey` FOREIGN KEY (`user1Id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_user2Id_fkey` FOREIGN KEY (`user2Id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_serviceBookingId_fkey` FOREIGN KEY (`serviceBookingId`) REFERENCES `ServiceBooking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
