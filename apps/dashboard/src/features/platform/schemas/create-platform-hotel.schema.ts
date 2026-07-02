import { z } from "zod";

export const createPlatformHotelSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens"),
  owner_name: z.string().min(2).max(255),
  owner_email: z.string().email(),
  owner_password: z.string().min(8),
  address: z.string().optional(),
  timezone: z.string().min(1),
  contact_phone: z.string().optional(),
  whatsapp_phone_number_id: z.string().optional(),
  subscription_tier: z.enum(["starter", "professional", "enterprise"]),
  seed_rooms_text: z.string().optional(),
});

export type CreatePlatformHotelValues = z.infer<typeof createPlatformHotelSchema>;

export function toPlatformHotelPayload(values: CreatePlatformHotelValues) {
  return {
    slug: values.slug,
    name: values.name,
    owner_name: values.owner_name,
    owner_email: values.owner_email,
    owner_password: values.owner_password,
    address: values.address || undefined,
    timezone: values.timezone,
    contact_phone: values.contact_phone || undefined,
    whatsapp_phone_number_id: values.whatsapp_phone_number_id || undefined,
    subscription_tier: values.subscription_tier,
    seed_rooms: parseSeedRooms(values.seed_rooms_text),
  };
}

function parseSeedRooms(value: string | undefined) {
  return (value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
