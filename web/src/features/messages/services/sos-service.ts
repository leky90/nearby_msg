/**
 * SOS Service
 * Handles sending SOS messages to all groups via replicate push
 */

import type { SOSType } from "@/shared/domain/message";
import { getDatabase } from "@/shared/services/db";
import { getOrCreateDeviceId } from "@/features/device/services/device-storage";
import { getGPSStatus } from "@/features/device/services/device-status";
import { getCurrentLocation } from "@/features/groups/services/location-service";
import { post } from "@/shared/services/api";
import { generateId } from "@/shared/utils/id";
import { log } from "@/shared/lib/logging/logger";

const SOS_COOLDOWN_DURATION = 30 * 1000; // 30 seconds
const LAST_SOS_KEY_PREFIX = "last_sos_";

/**
 * Gets the last SOS timestamp for a device
 */
function getLastSOSTimestamp(deviceId: string): number | null {
  const key = `${LAST_SOS_KEY_PREFIX}${deviceId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  return parseInt(stored, 10);
}

/**
 * Records that a device sent an SOS message
 */
function recordSOSMessage(deviceId: string): void {
  const key = `${LAST_SOS_KEY_PREFIX}${deviceId}`;
  localStorage.setItem(key, Date.now().toString());
}

/**
 * Checks if a device can send an SOS message (30 second cooldown)
 */
function checkSOSCooldown(deviceId: string): string | null {
  const lastSOS = getLastSOSTimestamp(deviceId);
  if (!lastSOS) {
    return null; // No previous SOS, allowed
  }

  const timeSinceLastSOS = Date.now() - lastSOS;
  if (timeSinceLastSOS < SOS_COOLDOWN_DURATION) {
    const remaining = Math.ceil(
      (SOS_COOLDOWN_DURATION - timeSinceLastSOS) / 1000
    );
    return `SOS cooldown active: please wait ${remaining} more seconds`;
  }

  return null;
}

/**
 * Gets SOS type label in Vietnamese (for message content)
 */
function getSOSTypeLabel(sosType: SOSType): string {
  const labels: Record<SOSType, string> = {
    medical: "SOS cấp cứu",
    flood: "SOS lũ lụt",
    fire: "SOS cháy nổ",
    // Đổi sang "SOS mắc kẹt" như yêu cầu
    missing_person: "SOS mắc kẹt",
  };
  return labels[sosType] || "SOS khẩn cấp";
}

/**
 * Sends SOS message to all groups via replicate push
 * @param sosType - Type of SOS
 * @returns Promise resolving to number of groups SOS was sent to
 */
export async function sendSOSToAllGroups(sosType: SOSType): Promise<number> {
  const deviceId = getOrCreateDeviceId();

  // Check cooldown
  const cooldownError = checkSOSCooldown(deviceId);
  if (cooldownError) {
    throw new Error(cooldownError);
  }

  // Check GPS permission - try to get location first (most reliable check)
  // If getCurrentLocation succeeds, permission is granted regardless of Permissions API status
  let location = await getCurrentLocation();
  if (!location) {
    // If getCurrentLocation fails, check permission status for better error message
    const gpsStatus = await getGPSStatus();
    if (gpsStatus === "denied") {
      throw new Error(
        "GPS đã bị từ chối. Vui lòng cấp quyền GPS trong cài đặt trình duyệt để gửi SOS."
      );
    }
    if (gpsStatus === "unavailable") {
      throw new Error(
        "Trình duyệt của bạn không hỗ trợ GPS. Vui lòng sử dụng trình duyệt khác."
      );
    }
    // If status is 'prompt' or unknown, location request might still work
    // But if getCurrentLocation already failed, throw generic error
    throw new Error(
      "Không thể lấy vị trí GPS. Vui lòng cấp quyền GPS và thử lại."
    );
  }

  // Get device nickname
  const db = await getDatabase();
  const deviceDoc = await db.devices.findOne(deviceId).exec();
  const deviceNickname = deviceDoc
    ? (deviceDoc.toJSON() as { nickname: string }).nickname
    : "Người dùng";

  // Get all groups
  const groupDocs = await db.groups.find().exec();
  const groups = groupDocs.map((doc) => doc.toJSON());

  if (groups.length === 0) {
    throw new Error("Không tìm thấy nhóm nào để gửi SOS.");
  }

  // Format SOS content: [Tên user] [loại SOS] [Địa chỉ GPS (lat,lng)]
  const sosTypeLabel = getSOSTypeLabel(sosType);
  const gpsLocation = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
  const sosContent = `${deviceNickname} · ${sosTypeLabel} · Vị trí: ${gpsLocation}`;

  // Create messages for all groups
  const now = new Date().toISOString();
  const messages = groups.map((group) => ({
    id: generateId(),
    group_id: group.id,
    content: sosContent,
    message_type: "sos" as const,
    sos_type: sosType,
    tags: ["urgent"],
    created_at: now,
    device_sequence: undefined,
  }));

  // Push messages via replicate push API
  try {
    await post("/replicate/push", { messages });
    log.info("SOS messages sent to all groups", {
      groupCount: groups.length,
      sosType,
      location,
    });

    // Record SOS message
    recordSOSMessage(deviceId);

    return groups.length;
  } catch (error) {
    log.error("Failed to send SOS messages", error, {
      groupCount: groups.length,
      sosType,
    });
    throw new Error(
      "Không thể gửi SOS. Vui lòng kiểm tra kết nối mạng và thử lại."
    );
  }
}
