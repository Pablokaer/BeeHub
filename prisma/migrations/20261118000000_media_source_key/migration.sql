-- Pixel-portrait avatars remember the private original they were generated from.
ALTER TABLE "MediaAsset" ADD COLUMN "sourceKey" TEXT;
