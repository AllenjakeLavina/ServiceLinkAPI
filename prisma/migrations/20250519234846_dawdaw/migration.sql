-- AlterTable
ALTER TABLE `review` ADD COLUMN `serviceBookingId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_serviceBookingId_fkey` FOREIGN KEY (`serviceBookingId`) REFERENCES `ServiceBooking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
