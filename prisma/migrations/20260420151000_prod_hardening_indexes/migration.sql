-- Harden hot query paths and enforce payment/revenue idempotency.
CREATE INDEX "User_role_idx" ON "User"("role");

CREATE INDEX "Property_hostId_idx" ON "Property"("hostId");
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

CREATE UNIQUE INDEX "Payment_mpesaTxId_key" ON "Payment"("mpesaTxId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");
CREATE INDEX "Payment_processedAt_idx" ON "Payment"("processedAt");
CREATE INDEX "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");

CREATE UNIQUE INDEX "RevenueRecord_bookingId_key" ON "RevenueRecord"("bookingId");
CREATE INDEX "RevenueRecord_hostId_payoutStatus_idx" ON "RevenueRecord"("hostId", "payoutStatus");
CREATE INDEX "RevenueRecord_createdAt_idx" ON "RevenueRecord"("createdAt");

CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_propertyId_status_startDate_endDate_idx"
  ON "Booking"("propertyId", "status", "startDate", "endDate");
