import { z } from "zod";

/**
 * Server-side auth validation schemas.
 * Source of truth — browser checks are UX only; every field is re-parsed
 * here before any auth or profile mutation. Rejects are logged and
 * surfaced as a single generic message so a rejected field can't leak
 * which one failed.
 */

// Reject (don't silently strip) HTML/script markers and control chars.
const NO_HTML = /^[^<>]*$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

const cleanText = (max: number) =>
  z
    .string()
    .transform((v) => v.normalize("NFKC").trim())
    .refine((v) => !CONTROL_CHARS.test(v), "invalid")
    .refine((v) => NO_HTML.test(v), "invalid")
    .refine((v) => v.length <= max, "invalid");

export const emailSchema = z.string().trim().toLowerCase().max(254).email();

/**
 * Password policy (server-authoritative).
 *
 * - 12+ chars (NIST recommends length over complexity, but we still
 *   require character-class diversity to defeat trivial patterns).
 * - Must include lowercase, uppercase, digit, and symbol.
 * - Rejects whitespace-only padding and 3+ repeated chars ("aaaa", "1111").
 * - Rejects a handful of obvious weak passwords that pass regex checks.
 * - Leaked-password (HIBP) rejection is enforced by Supabase Auth at
 *   signUp / updateUser time — this schema catches everything before we
 *   even call Supabase.
 */
const WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd",
  "qwerty", "qwerty123", "iloveyou", "admin", "welcome",
  "letmein", "monkey", "dragon", "master", "football",
  "abc123", "123456", "12345678", "123456789", "1234567890",
]);

export const passwordSchema = z
  .string()
  .min(12, "invalid")
  .max(128, "invalid")
  .refine((v) => /[a-z]/.test(v), "invalid")
  .refine((v) => /[A-Z]/.test(v), "invalid")
  .refine((v) => /\d/.test(v), "invalid")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "invalid")
  .refine((v) => !/\s/.test(v), "invalid")
  .refine((v) => !/(.)\1{2,}/.test(v), "invalid")
  .refine((v) => !WEAK_PASSWORDS.has(v.toLowerCase()), "invalid");

export const fullNameSchema = cleanText(80).pipe(z.string().min(2));

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^[+]?\d{7,20}$/.test(v), "invalid");

export const companyNameSchema = cleanText(120);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
});

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const profileUpdateSchema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema.optional().default(""),
  company_name: companyNameSchema.optional().default(""),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Uniform error surfaced to clients — never mentions which field failed. */
export const GENERIC_VALIDATION_ERROR = "Invalid submission.";
