/**
 * Vietnamese Translation System
 * Single-language translation object for emergency app
 *
 * Translation Keys Structure:
 * - sos.*: SOS emergency type labels and descriptions
 * - status.*: User safety status labels and descriptions
 * - group.type.*: Community group type labels
 * - button.*: Button labels (send, update, create, etc.)
 * - form.*: Form field labels
 * - common.*: Common UI text (cancel, confirm, save, etc.)
 * - error.*: Error messages
 * - network.*: Network status messages
 * - page.*: Page titles and descriptions
 *   - page.home.*: Home page content
 *   - page.chat.*: Chat page content
 *   - page.createGroup.*: Create group page content
 *   - page.nearbyGroups.*: Nearby groups page content
 * - component.*: Component-specific translations
 *   - component.sosSelector.*: SOS selector modal
 *   - component.statusSelector.*: Status selector component
 *   - component.messageInput.*: Message input component
 *   - component.createGroupForm.*: Create group form
 *   - component.chatHeader.*: Chat header component
 *   - component.groupCard.*: Group card component
 *   - component.statusSummary.*: Status summary component
 *   - component.pinnedMessages.*: Pinned messages modal
 *   - component.connectivityStatus.*: Connectivity status component
 * - message.sosDefault.*: Default SOS message templates
 *
 * Usage:
 * ```ts
 * import { t } from "@/shared/lib/i18n";
 * const label = t('button.send'); // "Gửi"
 * const message = t('page.home.title'); // "Cộng đồng Gần Bạn"
 * const withParams = t('component.groupCard.distance', { distance: '500m' }); // "Cách 500m"
 * ```
 */

export const translations = {
  sos: {
    medical: "Cấp cứu Y tế",
    flood: "Cấp cứu Lũ lụt",
    fire: "Cấp cứu Hỏa hoạn",
    // Đổi nội dung hiển thị sang SOS mắc kẹt
    missingPerson: "SOS mắc kẹt",
    description: {
      medical: "Cần hỗ trợ y tế khẩn cấp",
      flood: "Cần hỗ trợ sơ tán",
      fire: "Cần hỗ trợ chữa cháy khẩn cấp",
      // Mô tả cho SOS mắc kẹt
      missingPerson: "Có người đang bị mắc kẹt, cần hỗ trợ khẩn cấp",
    },
  },
  status: {
    safe: "Tôi an toàn",
    needHelp: "Cần hỗ trợ",
    cannotContact: "Không thể liên lạc",
    description: {
      safe: "Tôi an toàn và ổn",
      needHelp: "Tôi cần hỗ trợ",
      cannotContact: "Tôi không thể liên lạc",
    },
  },
  group: {
    type: {
      village: "Thôn",
      hamlet: "Xóm",
      residential_group: "Tổ dân phố",
      street_block: "Khu phố",
      ward: "Phường",
      commune: "Xã",
      apartment: "Chung cư",
      residential_area: "Khu dân cư",
      other: "Khác",
    },
  },
  button: {
    send: "Gửi",
    sendSOS: "Gửi SOS",
    updateStatus: "Cập nhật trạng thái",
    createGroup: "Tạo nhóm",
    joinGroup: "Tham gia nhóm",
    leaveGroup: "Rời nhóm",
    favorite: "Quan tâm",
    unfavorite: "Bỏ quan tâm",
    cancel: "Hủy",
    confirm: "Xác nhận",
    save: "Lưu",
    delete: "Xóa",
    edit: "Sửa",
    close: "Đóng",
    back: "Quay lại",
    next: "Tiếp theo",
  },
  form: {
    groupName: "Tên nhóm",
    groupType: "Loại nhóm",
    location: "Vị trí",
    latitude: "Vĩ độ",
    longitude: "Kinh độ",
    description: "Mô tả",
    message: "Tin nhắn",
    nickname: "Biệt danh",
    statusDescription: "Mô tả trạng thái",
  },
  error: {
    required: "Trường này là bắt buộc",
    invalid: "Giá trị không hợp lệ",
    network: "Lỗi kết nối mạng",
    unknown: "Đã xảy ra lỗi. Vui lòng thử làm mới trang.",
    messageEmpty: "Tin nhắn không được để trống",
    messageTooLong: "Tin nhắn không được quá 500 ký tự",
    groupNameRequired: "Tên nhóm là bắt buộc",
    locationRequired: "Vị trí là bắt buộc",
  },
  network: {
    online: "Đã kết nối",
    offline: "Không có kết nối",
    syncing: "Đang đồng bộ...",
    pending: "{count} đang chờ",
    synced: "Đã đồng bộ",
  },
  page: {
    home: {
      title: "Cộng đồng Gần Bạn",
      subtitle:
        "Kết nối với cộng đồng địa phương để chia sẻ thông tin khẩn cấp và hỗ trợ lẫn nhau",
      emergencySOS: "SOS Khẩn cấp",
      emergencySOSDescription: "Gửi tin nhắn SOS khẩn cấp đến các nhóm gần đây",
      myStatus: "Trạng thái của tôi",
      myStatusDescription:
        "Cập nhật trạng thái an toàn để người khác biết tình hình của bạn",
      discoverGroups: "Khám phá Nhóm",
      discoverGroupsDescription: "Tìm và tham gia các nhóm khu vực gần đây",
      createGroup: "Tạo Nhóm",
      createGroupDescription:
        "Tạo nhóm theo khu vực để chia sẻ thông tin khẩn cấp",
      favoriteGroups: "Nhóm Quan tâm",
      favoriteGroupsDescription:
        "Theo dõi các nhóm khu vực quan trọng để nhận thông tin khẩn cấp",
      noFavoriteGroups:
        "Chưa có nhóm quan tâm. Khám phá nhóm để theo dõi các khu vực quan trọng.",
    },
    chat: {
      noGroupSelected: "Chưa chọn nhóm",
      errorLoadingMessages: "Lỗi tải tin nhắn",
      typeMessage: "Nhập tin nhắn...",
      noMessages: "Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện!",
    },
    nearbyGroups: {
      title: "Nhóm Gần Đây",
      description: "Tìm và tham gia các nhóm khu vực gần bạn",
      noGroupsFound: "Không tìm thấy nhóm nào trong bán kính {radius}m.",
      tryIncreasingRadius:
        "Thử tăng bán kính tìm kiếm hoặc tạo nhóm khu vực mới.",
    },
    createGroup: {
      title: "Tạo Nhóm Khu Vực",
      description:
        "Tạo nhóm theo khu vực để chia sẻ thông tin khẩn cấp và hỗ trợ lẫn nhau. Mỗi thiết bị chỉ có thể tạo một nhóm.",
      groupCreated: 'Nhóm "{name}" đã được tạo.',
      canStartChatting:
        "Bạn có thể bắt đầu chia sẻ thông tin khẩn cấp với các thành viên trong khu vực gần đây.",
    },
  },
  component: {
    sosSelector: {
      title: "Chọn Loại Cấp cứu",
      selectEmergencyType: "Chọn loại cấp cứu",
    },
    statusSelector: {
      title: "Cập nhật Trạng thái An toàn",
      description: "Cho người khác biết trạng thái an toàn hiện tại của bạn",
      status: "Trạng thái",
      descriptionLabel: "Mô tả (Tùy chọn)",
      descriptionPlaceholder: "Thêm chi tiết bổ sung...",
      charactersRemaining: "{count}/200 ký tự",
      updating: "Đang cập nhật...",
      updateStatus: "Cập nhật Trạng thái",
      lastUpdated: "Cập nhật lần cuối: {date}",
    },
    messageInput: {
      placeholder: "Nhập tin nhắn...",
      messageSent: "Tin nhắn đã gửi",
      messageCannotBeEmpty: "Tin nhắn không được để trống",
      messageTooLong: "Tin nhắn không được quá {max} ký tự",
      failedToSend: "Gửi tin nhắn thất bại",
    },
    createGroupForm: {
      groupName: "Tên nhóm",
      groupNamePlaceholder: "Nhập tên nhóm",
      groupNameRequired: "Tên nhóm là bắt buộc",
      groupNameTooLong: "Tên nhóm không được quá 100 ký tự",
      charactersRemaining: "{count} ký tự còn lại",
      loadingSuggestions: "Đang tải gợi ý...",
      groupType: "Loại nhóm",
      location: "Vị trí",
      gettingLocation: "Đang lấy vị trí của bạn...",
      locationNotAvailable: "Không có vị trí. Vui lòng nhập tọa độ thủ công.",
      latitude: "Vĩ độ",
      longitude: "Kinh độ",
      latitudePlaceholder: "-90 đến 90",
      longitudePlaceholder: "-180 đến 180",
      latitudeInvalid: "Vĩ độ phải từ -90 đến 90",
      longitudeInvalid: "Kinh độ phải từ -180 đến 180",
      locationRequired: "Vị trí là bắt buộc",
      creating: "Đang tạo...",
      createGroup: "Tạo Nhóm Khu Vực",
      alreadyCreatedGroup:
        "Bạn đã tạo nhóm. Mỗi thiết bị chỉ có thể tạo một nhóm khu vực.",
      failedToCreate: "Tạo nhóm thất bại. Vui lòng thử lại.",
    },
    chatHeader: {
      offline: "Không có kết nối",
      syncing: "Đang đồng bộ...",
      pending: "{count} đang chờ",
      synced: "Đã đồng bộ",
      viewPinnedMessages: "Xem tin nhắn đã ghim",
      favoriteGroup: "Quan tâm nhóm",
      unfavoriteGroup: "Bỏ quan tâm nhóm",
    },
    groupCard: {
      distance: "Cách {distance}",
      members: "{count} tin nhắn",
      online: "{count} đang online",
    },
    statusSummary: {
      title: "Trạng thái An toàn Nhóm",
      noStatus: "Chưa có thông tin trạng thái",
      safe: "{count} an toàn",
      needHelp: "{count} cần hỗ trợ",
      cannotContact: "{count} không thể liên lạc",
      total: "Tổng: {count}",
    },
    pinnedMessages: {
      title: "Tin nhắn đã ghim",
      description: "Tin nhắn quan trọng đã được ghim",
      noPinnedMessages: "Chưa có tin nhắn nào được ghim",
    },
    connectivityStatus: {
      online: "Đã kết nối",
      offline: "Không có kết nối",
      syncing: "Đang đồng bộ...",
    },
  },
  common: {
    cancel: "Hủy",
    confirm: "Xác nhận",
    send: "Gửi",
    save: "Lưu",
    delete: "Xóa",
    edit: "Sửa",
    close: "Đóng",
    back: "Quay lại",
    next: "Tiếp theo",
    loading: "Đang tải...",
    error: "Lỗi",
    success: "Thành công",
    select: "Chọn",
    search: "Tìm kiếm",
    filter: "Lọc",
    clear: "Xóa",
    apply: "Áp dụng",
    tryAgain: "Thử lại",
    refresh: "Làm mới",
    urgent: "KHẨN CẤP",
    pinned: "Đã ghim",
    goToMessage: "Đi tới tin nhắn",
    unread: "chưa đọc",
  },
  message: {
    sosDefault: {
      medical: "🚨 Cấp cứu Y tế - Cần hỗ trợ khẩn cấp!",
      flood: "🚨 Cấp cứu Lũ lụt - Cần hỗ trợ sơ tán!",
      fire: "🚨 Cấp cứu Hỏa hoạn - Cần hỗ trợ khẩn cấp!",
      // Nội dung mặc định cho SOS mắc kẹt
      missing_person: "🚨 SOS mắc kẹt - Cần hỗ trợ khẩn cấp!",
      default: "🚨 Cấp cứu - Cần hỗ trợ!",
    },
  },
} as const;

export type TranslationKey = keyof typeof translations | string;

import { log } from "./logging/logger";

/**
 * Helper function to get nested translation value
 * @param key - Translation key path (e.g., "sos.medical" or "button.send")
 * @param params - Optional parameters for string interpolation
 * @returns Translated string
 */
export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const keys = key.split(".");
  let value: unknown = translations;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k as keyof typeof value];
    } else {
      log.warn("Translation key not found", { key });
      return key;
    }
  }

  if (typeof value !== "string") {
    log.warn("Translation value is not a string", { key });
    return key;
  }

  // Simple string interpolation
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }

  return value;
}
