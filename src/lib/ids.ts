import crypto from "crypto";

// Crockford-ish base32 without ambiguous chars
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomCode(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function participantCode(): string {
  return `CYG26-P-${randomCode(4)}`;
}

export function certificateCode(): string {
  return `CYG26-CERT-${randomCode(5)}`;
}

export function teamCode(seq: number): string {
  return `TEAM-${String(seq).padStart(2, "0")}`;
}

export function deploymentToken(): string {
  return `SHIP-${randomCode(4)}-${randomCode(4)}`;
}

export function sessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
