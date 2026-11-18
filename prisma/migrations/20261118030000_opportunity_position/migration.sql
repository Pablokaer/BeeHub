-- Position chosen from the catalog (src/lib/positions.ts), used to filter opportunities.
-- Nullable: opportunities created before positions existed keep working and can be edited to add one.
ALTER TABLE "Opportunity" ADD COLUMN "position" TEXT;
CREATE INDEX "Opportunity_position_idx" ON "Opportunity"("position");
