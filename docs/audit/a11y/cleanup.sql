-- Removes the data the a11y audit creates (everything is tagged with "[a11y-audit]").
-- Usage:
--   docker exec -i collab-hub-pg psql -U hub -d collab_hub -v since="'2026-11-11 09:00'" < docs/audit/a11y/cleanup.sql
-- `since` = UTC time the audit run started (bounds the notification/audit-log cleanup).
BEGIN;

-- Comments: fix the denormalised counter, then delete.
UPDATE "Post" p SET "commentCount" = GREATEST(0, p."commentCount" - c.n)
FROM (SELECT "postId", count(*)::int n FROM "Comment" WHERE body LIKE '%[a11y-audit]%' GROUP BY "postId") c
WHERE p.id = c."postId";
DELETE FROM "Comment" WHERE body LIKE '%[a11y-audit]%';

-- Likes ana added during the run (the Like flow toggles back, but a lost-focus run can leave one).
UPDATE "Post" p SET "likeCount" = GREATEST(0, p."likeCount" - 1)
FROM "Reaction" r JOIN "User" a ON a.id = r."userId"
WHERE a.username = 'ana' AND r."postId" = p.id AND r."createdAt" >= :since::timestamp;
DELETE FROM "Reaction" r USING "User" a WHERE a.username = 'ana' AND r."userId" = a.id AND r."createdAt" >= :since::timestamp;

DELETE FROM "Post" WHERE body LIKE '%[a11y-audit]%';
DELETE FROM "Message" WHERE body LIKE '%[a11y-audit]%';
DELETE FROM "Application" WHERE message LIKE '%[a11y-audit]%';
DELETE FROM "Project" WHERE slug = 'a11y-audit-private';

-- Pending connection request ana -> elena, if the keyboard flow could not withdraw it.
DELETE FROM "Connection" c USING "User" a, "User" e
WHERE a.username = 'ana' AND e.username = 'elena' AND c.status = 'PENDING' AND c."requesterId" = a.id
  AND ((c."userAId" = a.id AND c."userBId" = e.id) OR (c."userAId" = e.id AND c."userBId" = a.id));

-- Notifications / audit-log rows raised by ana's actions during the run.
DELETE FROM "Notification" n USING "User" a WHERE a.username = 'ana' AND n."actorId" = a.id AND n."createdAt" >= :since::timestamp;
DELETE FROM "AuditLog" l USING "User" a WHERE a.username = 'ana' AND l."actorId" = a.id AND l."createdAt" >= :since::timestamp;

COMMIT;
