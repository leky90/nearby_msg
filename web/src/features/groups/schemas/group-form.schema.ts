/**
 * Group Form Validation Schema
 * Zod schema for validating group creation and editing forms
 */

import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Tên nhóm không được để trống")
    .max(100, "Tên nhóm không được vượt quá 100 ký tự")
    .regex(
      /^[\p{L}\p{N}\s\-.,()/]+$/u,
      "Tên nhóm chỉ được chứa chữ cái (bao gồm tiếng Việt), số, khoảng trắng và các ký tự: - . , ( ) /"
    ),
  type: z.enum([
    "village",
    "hamlet",
    "residential_group",
    "street_block",
    "ward",
    "commune",
    "apartment",
    "residential_area",
    "other",
  ]),
  latitude: z
    .number()
    .min(-90, "Vĩ độ không hợp lệ")
    .max(90, "Vĩ độ không hợp lệ"),
  longitude: z
    .number()
    .min(-180, "Kinh độ không hợp lệ")
    .max(180, "Kinh độ không hợp lệ"),
});

export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
