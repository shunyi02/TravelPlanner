-- CreateTable
CREATE TABLE "TripInvite" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripInvite_tripId_email_key" ON "TripInvite"("tripId", "email");

-- AddForeignKey
ALTER TABLE "TripInvite" ADD CONSTRAINT "TripInvite_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
