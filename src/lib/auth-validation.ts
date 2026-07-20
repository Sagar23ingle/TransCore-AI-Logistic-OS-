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

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/)
  .regex(/\d/);

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
