/**
 * Nickname Validation Schema
 * Zod schema for validating nickname editing
 */

import { z } from "zod";

export const nicknameSchema = z.object({
  nickname: z
    .string()
    .min(1, "Tên hiển thị phải có từ 1-50 ký tự")
    .max(50, "Tên hiển thị phải có từ 1-50 ký tự")
    .regex(
      /^[a-zA-Z0-9\s-]+$/,
      "Tên hiển thị chỉ được chứa chữ cái, số, khoảng trắng và dấu gạch ngang"
    ),
});

export type NicknameFormData = z.infer<typeof nicknameSchema>;
