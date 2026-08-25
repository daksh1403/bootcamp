import { z } from "zod";

export const registrationSchema = z.object({
  name: z.string().trim().min(3, "Enter your full name").max(80),
  regNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8,15}$/, "Registration number: 8–15 letters/digits"),
  email: z.string().trim().toLowerCase().email("Valid VIT email required").endsWith("@vitstudent.ac.in", "Use your @vitstudent.ac.in email"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit Indian mobile number"),
  branch: z.enum(["CSE", "CSE-AI&ML", "CSE-DS", "IT", "AI&ML", "ECE", "EEE", "MECH", "CIVIL", "OTHER"]),
  year: z.enum(["1", "2", "3", "4", "5"]),
  ram: z.enum(["4GB", "8GB", "16GB+"]),
  os: z.enum(["Windows 11", "Windows 10", "macOS", "Linux"]),
  dockerInstalled: z.enum(["yes", "no"]),
  githubUsername: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, "Invalid GitHub username")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): { ok: true; data: z.output<T> } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
