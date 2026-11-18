export type ProfileLink = { label: string; url: string };

/** Normalize handles and scheme-less addresses without allowing active URL schemes. */
export function normalizeProfileLink(link: ProfileLink): ProfileLink {
  const label = link.label.trim();
  const platform = label.toLowerCase();
  let value = link.url.trim();
  if (!value) throw new Error("Enter a profile link");
  if (platform === "github" && /^@?[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(value)) value = `https://github.com/${value.replace(/^@/, "")}`;
  if (platform === "linkedin" && /^@?[a-z\d_-]+$/i.test(value)) value = `https://www.linkedin.com/in/${value.replace(/^@/, "")}`;
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid profile URL or username"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) throw new Error("Use a public http:// or https:// URL");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (platform === "github" && host !== "github.com") throw new Error("Use a github.com link or GitHub username");
  if (platform === "linkedin" && host !== "linkedin.com" && !host.endsWith(".linkedin.com")) throw new Error("Use a linkedin.com link or LinkedIn username");
  return { label, url: url.href };
}
