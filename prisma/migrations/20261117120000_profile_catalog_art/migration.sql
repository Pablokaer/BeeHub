-- Catalog illustrations chosen for a profile, stored by manifest id. Nullable, so existing
-- profiles keep their uploaded image, no image, or the default fallback.
ALTER TABLE "Profile" ADD COLUMN "avatarArt" TEXT;
ALTER TABLE "Profile" ADD COLUMN "coverArt" TEXT;
