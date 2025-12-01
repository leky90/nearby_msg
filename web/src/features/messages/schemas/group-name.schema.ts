/**
 * Group Name Validation Schema
 * Zod schema for validating group name editing
 */

import { z } from "zod";

export const groupNameSchema = z.object({
  name: z
    .string()
    .min(1, "Tên nhóm không được để trống")
    .max(100, "Tên nhóm không được vượt quá 100 ký tự")
    .regex(
      /^[\p{L}\p{N}\s\-.,()/]+$/u,
      "Tên nhóm chỉ được chứa chữ cái (bao gồm tiếng Việt), số, khoảng trắng và các ký tự: - . , ( ) /"
    ),
});

export type GroupNameFormData = z.infer<typeof groupNameSchema>;
