/**
 * Onboarding Form Validation Schema
 * Zod schema for validating onboarding form (nickname and location)
 */

import { z } from "zod";

export const onboardingSchema = z.object({
  nickname: z
    .string()
    .min(1, "Tên hiển thị phải có từ 1-50 ký tự")
    .max(50, "Tên hiển thị phải có từ 1-50 ký tự")
    .regex(
      /^[a-zA-Z0-9\s-]+$/,
      "Tên hiển thị chỉ được chứa chữ cái, số, khoảng trắng và dấu gạch ngang"
    ),
  location: z
    .object({
      latitude: z
        .number()
        .min(-90, "Vĩ độ không hợp lệ")
        .max(90, "Vĩ độ không hợp lệ"),
      longitude: z
        .number()
        .min(-180, "Kinh độ không hợp lệ")
        .max(180, "Kinh độ không hợp lệ"),
    })
    .optional(), // Optional in schema, but required in business logic
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
