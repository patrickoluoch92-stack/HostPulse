-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_propertyId_idx" ON "Booking"("propertyId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Payment_mpesaTxId_idx" ON "Payment"("mpesaTxId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_escrowReleased_escrowHeldUntil_idx" ON "Payment"("status", "escrowReleased", "escrowHeldUntil");

-- CreateIndex
CREATE INDEX "RevenueRecord_bookingId_idx" ON "RevenueRecord"("bookingId");

-- CreateIndex
CREATE INDEX "RevenueRecord_hostId_idx" ON "RevenueRecord"("hostId");

-- CreateIndex
CREATE INDEX "RevenueRecord_payoutStatus_idx" ON "RevenueRecord"("payoutStatus");
