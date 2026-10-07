import { z } from "zod";
import { CATEGORIES, LOCATIONS, OTHER_LOCATION, UIU_EMAIL_ERROR, UIU_EMAIL_PATTERN } from "@/constants";

/**
 * Every form rule in one place, as Zod schemas driven by React Hook Form.
 *
 * These mirror what the FastAPI backend enforces — they are not a substitute
 * for it. A browser check can always be bypassed, so the server validates the
 * same rules again; this layer exists so a member sees
 * the problem before a round trip, not so the API can trust the payload.
 */

const uiuEmail = z
  .string()
  .trim()
  .min(1, "Enter your UIU email.")
  .regex(UIU_EMAIL_PATTERN, UIU_EMAIL_ERROR);

export const loginSchema = z.object({
  email: uiuEmail,
  password: z.string().min(1, "Enter your password."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(120),
    email: uiuEmail,
    department: z.string().trim().max(120).optional(),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(1, "Repeat your password."),
  })
  // Attached to `confirm` so the message lands under the field that is wrong.
  .refine(values => values.password === values.confirm, {
    message: "Both passwords must match.",
    path: ["confirm"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const claimSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, "Add at least a sentence that shows this item is yours.")
    .max(2000, "Keep the verification message under 2000 characters."),
});

export type ClaimValues = z.infer<typeof claimSchema>;

/** The end of today, so "not in the future" accepts a report filed this morning. */
function endOfToday() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

export const itemSchema = z
  .object({
    title: z.string().trim().min(2, "Give the item a short, recognisable name.").max(180),
    category: z.enum(CATEGORIES, { message: "Choose a category." }),
    description: z
      .string()
      .trim()
      .min(10, "Add at least a sentence describing the item.")
      .max(5000),
    // "Other" reveals a free-text box — UniFind has no map, so location is
    // either a known campus place or whatever the member types.
    locationChoice: z.enum(LOCATIONS, { message: "Choose where on campus this happened." }),
    customLocation: z.string().trim().max(180).optional(),
    date: z
      .string()
      .min(1, "Select a date.")
      .refine(value => new Date(value) <= endOfToday(), "The date cannot be in the future."),
    brand: z.string().trim().max(100).optional(),
    color: z.string().trim().max(80).optional(),
    model: z.string().trim().max(120).optional(),
    identifying: z.string().trim().max(3000).optional(),
    imageUrl: z.string().nullable(),
  })
  .refine(
    values => values.locationChoice !== OTHER_LOCATION || !!values.customLocation?.trim(),
    { message: "Describe where on campus this happened.", path: ["customLocation"] }
  );

export type ItemValues = z.infer<typeof itemSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z.string().min(8, "Use at least 8 characters."),
    confirm_password: z.string().min(1, "Confirm your new password."),
  })
  .refine(values => values.new_password === values.confirm_password, {
    message: "Both passwords must match.",
    path: ["confirm_password"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/** Collapses the two location fields back into the single string the API takes. */
export const resolveLocation = (values: Pick<ItemValues, "locationChoice" | "customLocation">) =>
  values.locationChoice === OTHER_LOCATION
    ? (values.customLocation ?? "").trim()
    : values.locationChoice;
