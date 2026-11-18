import { describe, expect, it } from "vitest";
import { normalizeProfileLink } from "@/lib/profile-links";
import { formToObject, profileLinkSchema, signupSchema } from "@/lib/validation";

describe("platform profile links", () => {
  it("accepts handles and scheme-less platform addresses", () => {
    expect(normalizeProfileLink({ label: "GitHub", url: "@ana-dev" }).url).toBe("https://github.com/ana-dev");
    expect(normalizeProfileLink({ label: "LinkedIn", url: "ana-ribeiro" }).url).toBe("https://www.linkedin.com/in/ana-ribeiro");
    expect(normalizeProfileLink({ label: "Personal website", url: "ana.example/work" }).url).toBe("https://ana.example/work");
    expect(profileLinkSchema.parse({ label: "GitHub", url: "github.com/ana" }).url).toBe("https://github.com/ana");
  });
  it("rejects unsafe schemes, credentials and disguised platform domains", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:password@example.com"]) {
      expect(profileLinkSchema.safeParse({ label: "Portfolio", url }).success).toBe(false);
    }
    expect(profileLinkSchema.safeParse({ label: "GitHub", url: "https://github.com.evil.example/ana" }).success).toBe(false);
    expect(profileLinkSchema.safeParse({ label: "LinkedIn", url: "https://notlinkedin.com/in/ana" }).success).toBe(false);
  });
  it("carries normalized optional links through the signup form contract", () => {
    const fd = new FormData();
    fd.set("displayName", "Ana Ribeiro"); fd.set("email", "ana@example.com"); fd.set("password", "correct horse battery");
    fd.append("links[].label", "GitHub"); fd.append("links[].url", "@ana-dev");
    fd.append("links[].label", "Portfolio"); fd.append("links[].url", "ana.example");
    expect(signupSchema.parse(formToObject(fd)).links).toEqual([{label: "GitHub", url: "https://github.com/ana-dev"}, {label: "Portfolio", url: "https://ana.example/"}]);
    fd.delete("links[].label"); fd.delete("links[].url");
    expect(signupSchema.parse(formToObject(fd)).links).toBeUndefined();
  });
  it("caps the list at eight links and rejects incomplete rows", () => {
    const base = { displayName: "Ana", email: "ana@example.com", password: "correct horse battery" };
    expect(signupSchema.safeParse({...base, links: Array.from({length:9},()=>({label:"Portfolio",url:"https://example.com"}))}).success).toBe(false);
    expect(profileLinkSchema.safeParse({label:"LinkedIn",url:""}).success).toBe(false);
  });
});
