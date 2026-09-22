-- CreateTable
CREATE TABLE "PlaceAssignment" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PlaceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceAssignment_placeId_userId_key" ON "PlaceAssignment"("placeId", "userId");

-- AddForeignKey
ALTER TABLE "PlaceAssignment" ADD CONSTRAINT "PlaceAssignment_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceAssignment" ADD CONSTRAINT "PlaceAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
