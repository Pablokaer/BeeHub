import { expect, test } from "@playwright/test";
import { account, expectToast, newUserPage, signUpAndVerify, L, T } from "./helpers";

test("Scenarios D & F: connect, then post, mention, like, comment and share", async ({ page, browser }) => {
  const a = account("ann", "Ann Author");
  await signUpAndVerify(page, a);
  const bPage = await newUserPage(browser);
  const b = account("ben", "Ben Reader");
  await signUpAndVerify(bPage, b);

  // Scenario D — connection request and acceptance.
  await page.goto(`/u/${b.username}`);
  await page.getByRole("button", { name: `Connect with ${b.name}` }).click();
  await expectToast(page, "Connection request sent.");
  await bPage.goto("/network/requests");
  await expect(bPage.getByRole("link", { name: a.name })).toBeVisible();
  await bPage.getByRole("button", { name: "Accept" }).click();
  await expectToast(bPage, "Connected.");
  await bPage.goto("/network");
  await expect(bPage.getByRole("link", { name: a.name })).toBeVisible();

  // Scenario F — a post with a mention and a hashtag.
  await page.goto("/feed");
  await L(page, "Post text").click();
  await L(page, "Post text").fill(`Kicking off a new project with @${b.username} #e2etesting`);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expectToast(page, "Posted.");

  await bPage.goto("/notifications");
  await expect(T(bPage, /mentioned you/)).toBeVisible();
  await bPage.goto("/feed?mode=latest");
  const post = bPage.getByRole("article", { name: `Post by ${a.name}` }).first();
  await expect(post.getByRole("link", { name: `@${b.username}` })).toBeVisible();
  await post.getByRole("button", { name: /\bLike/ }).click();
  await expect(post.getByRole("button", { name: /Unlike/ })).toBeVisible();

  await post.getByRole("button", { name: "Share options" }).click();
  await bPage.getByRole("menuitem", { name: "Share now" }).click();
  await expectToast(bPage, "Shared to your feed.");

  await bPage.goto("/feed?mode=latest");
  // Commenting from the feed opens the composer under the post instead of navigating away.
  const feedPost = bPage.getByRole("article", { name: `Post by ${a.name}` }).first();
  await feedPost.getByRole("button", { name: /Comment$/ }).click();
  await expect(bPage).toHaveURL(/\/feed/);
  await feedPost.getByLabel("Comment", { exact: true }).fill(`Count me in, @${a.username}!`);
  await feedPost.getByRole("button", { name: "Comment", exact: true }).click();
  await expectToast(bPage, "Comment posted.");
  await feedPost.getByRole("link", { name: /View all 1 comment/ }).click();
  await expect(T(bPage, "Count me in,")).toBeVisible();

  await page.goto("/notifications");
  await expect(T(page, /commented/)).toBeVisible();
  await expect(T(page, /liked your post/)).toBeVisible();
  await expect(T(page, /shared your post/)).toBeVisible();

  await page.goto("/tags/e2etesting");
  await expect(T(page, "Kicking off a new project")).toBeVisible();
});
