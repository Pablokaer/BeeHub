import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** OWASP-recommended scrypt parameters (N=2^15, r=8, p=3). Tests use a cheaper cost. */
function params() {
  if (process.env.NODE_ENV === "test" && (process.env.SCRYPT_FAST === "1" || process.env.SCRYPT_FAST === "true")) return { N: 1024, r: 8, p: 1 };
  return { N: 32768, r: 8, p: 3 };
}

const KEYLEN = 64;

/** Hash format: scrypt$N$r$p$saltB64$hashB64 (parameters stored so they can evolve). */
export async function hashPassword(password: string): Promise<string> {
  const { N, r, p } = params();
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: 128 * N * r * 2 });
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = Number(nStr), r = Number(rStr), p = Number(pStr);
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N, r, p, maxmem: 128 * N * r * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A dummy hash used to keep login timing similar for unknown emails. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword("not-a-real-password-" + randomBytes(8).toString("hex"));
  return dummyHash;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
