-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "dietaryNotes" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "homeCurrency" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passportExpiry" DATE,
ADD COLUMN     "passportNumberEncrypted" TEXT,
ADD COLUMN     "phone" TEXT;
