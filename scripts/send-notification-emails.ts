/** CLI entry for the notification email digest (e.g. from cron): npm run notifications:email */
import "dotenv/config";
import { deliverQueuedNotificationEmails } from "../src/server/notification-email";

deliverQueuedNotificationEmails()
  .then((r) => {
    console.log(JSON.stringify({ event: "notifications.email_digest.done", ...r }));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
