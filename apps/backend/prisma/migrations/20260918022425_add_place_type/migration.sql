-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('STOP', 'HOTEL', 'FLIGHT');

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "arrivalAirport" TEXT,
ADD COLUMN     "arrivalTime" TIMESTAMP(3),
ADD COLUMN     "checkIn" TIMESTAMP(3),
ADD COLUMN     "checkOut" TIMESTAMP(3),
ADD COLUMN     "departureAirport" TEXT,
ADD COLUMN     "departureTime" TIMESTAMP(3),
ADD COLUMN     "type" "PlaceType" NOT NULL DEFAULT 'STOP';
