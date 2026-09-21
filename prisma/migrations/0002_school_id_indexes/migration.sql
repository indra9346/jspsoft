-- Every school-owned table gets an index that leads with schoolId (tenant-scoped queries).
CREATE INDEX "AnnouncementTarget_schoolId_idx" ON "AnnouncementTarget"("schoolId");
CREATE INDEX "BusStop_schoolId_idx" ON "BusStop"("schoolId");
