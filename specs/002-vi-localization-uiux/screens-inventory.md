# Báo Cáo Kiểm Kê Màn Hình Hiện Có

**Ngày tạo**: 2025-01-27  
**Mục đích**: Liệt kê tất cả màn hình hiện có trong ứng dụng để cập nhật spec và lập kế hoạch localization/UIUX

## Tổng Quan

Ứng dụng hiện có **4 màn hình chính** được implement, nhưng **chưa có routing system**. Tất cả navigation đang được xử lý thông qua state management trong component `Home`.

## Chi Tiết Màn Hình

### 1. Home Screen (`/src/pages/Home.tsx`)

**Trạng thái**: ✅ Đã implement, đang được sử dụng làm entry point  
**Routing**: Không có (được render trực tiếp trong `App.tsx`)

#### Chức năng chính:

- **Emergency SOS Button**: Nút gửi tin nhắn SOS khẩn cấp
- **My Status Section**:
  - Hiển thị trạng thái hiện tại (StatusIndicator)
  - Selector để cập nhật trạng thái (StatusSelector)
- **Discover Groups**: Nút điều hướng đến màn hình NearbyGroups (TODO: chưa có routing)
- **Create Group**: Nút chuyển sang view tạo nhóm mới
- **Favorite Groups**:
  - Danh sách các nhóm yêu thích
  - Hiển thị khoảng cách và số tin nhắn chưa đọc
  - TODO: Chưa có navigation đến ChatPage khi click

#### View States:

- `"home"`: View mặc định
- `"create-group"`: Hiển thị `CreateGroupPage` component

#### Components sử dụng:

- `SOSButton`
- `StatusSelector`, `StatusIndicator`
- `ConnectivityStatus`
- `FavoriteGroupCard`
- `CreateGroupPage` (conditional render)

#### Text cần dịch:

- "Nearby Community Chat" (tiêu đề)
- "Connect with your local community during emergencies" (mô tả)
- "Emergency SOS"
- "Send an emergency SOS message to nearby groups"
- "My Status"
- "Update your safety status to let others know how you're doing"
- "Discover Groups"
- "Find and join nearby community groups"
- "Browse Nearby Groups"
- "Create Group"
- "Create a new community group for your area"
- "Create New Group"
- "Favorite Groups"
- "Quick access to your favorite community groups"
- "No favorite groups yet. Discover groups to add favorites."

---

### 2. CreateGroupPage (`/src/pages/CreateGroupPage.tsx`)

**Trạng thái**: ✅ Đã implement  
**Routing**: Không có (được render conditionally trong `Home.tsx`)

#### Chức năng chính:

- Form tạo nhóm mới với:
  - Group Name (input text, max 100 chars)
  - Group Type (select: Neighborhood, Ward, District, Apartment, Other)
  - Location (auto-detect hoặc manual entry)
- Success state sau khi tạo thành công
- Back button để quay về Home

#### States:

- Form state: Hiển thị form tạo nhóm
- Success state: Hiển thị thông báo thành công sau khi tạo

#### Components sử dụng:

- `CreateGroupForm`
- `Button`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`

#### Text cần dịch:

- "Back"
- "Create a New Group"
- "Create a community group for your area. Each device can create one group."
- "Group Created Successfully!"
- "Your group \"{name}\" has been created."
- "You can now start chatting with nearby community members."
- "Go to Home"

#### Text trong CreateGroupForm:

- "Group Name"
- "Enter group name"
- "Group Type"
- "Location"
- "Getting your location..."
- "Latitude", "Longitude"
- "Location not available. Please enter coordinates manually."
- "Create Group"
- "Creating..."
- "Cancel"
- "Group name is required"
- "Group name must be 100 characters or less"
- "Location is required"
- "You have already created a group. Each device can only create one group."
- "Failed to create group"
- "Loading suggestions..."
- "{X} characters remaining"

---

### 3. ChatPage (`/src/pages/ChatPage.tsx`)

**Trạng thái**: ✅ Đã implement  
**Routing**: ❌ Chưa có routing, chưa được kết nối với navigation

#### Chức năng chính:

- Hiển thị chat interface cho một group cụ thể
- Message list với reactive updates
- Message input để gửi tin nhắn
- Chat header với group info, SOS button, favorite toggle, pinned messages

#### Props:

- `groupId: string` (required)

#### Components sử dụng:

- `ChatHeader`
- `MessageList`
- `MessageInput`
- `Skeleton` (loading state)

#### States:

- Loading state: Hiển thị skeleton khi đang tải group info
- Error state: Hiển thị lỗi nếu không load được group
- Empty state: Hiển thị "No group selected" nếu không có groupId

#### Text cần dịch:

- "No group selected"
- "Error loading messages: {error message}"

#### Text trong ChatHeader:

- "Neighborhood", "Ward", "District", "Apartment", "Other" (group type labels)
- "Offline"
- "Syncing..."
- "{X} pending"
- "Synced"
- "View pinned messages"
- "Unfavorite group" / "Favorite group"

---

### 4. NearbyGroups (`/src/pages/NearbyGroups.tsx`)

**Trạng thái**: ✅ Đã implement  
**Routing**: ❌ Chưa có routing, chưa được kết nối với navigation

#### Chức năng chính:

- Hiển thị danh sách các nhóm gần đây
- Radius filter (500m, 1km, 2km)
- Hiển thị khoảng cách và thông tin nhóm
- Offline indicator
- TODO: Chưa có navigation đến ChatPage khi click vào group

#### Components sử dụng:

- `GroupCard`
- `RadiusFilter`
- `OfflineIndicator`
- `Skeleton` (loading state)
- `Card`, `CardContent`

#### States:

- Loading: Hiển thị skeleton khi đang tải
- Empty: Hiển thị message khi không tìm thấy nhóm
- Error: Hiển thị lỗi (location unavailable, etc.)

#### Text cần dịch:

- "Nearby Groups"
- "No groups found within {radius}m radius."
- "Try increasing the search radius or create a new group."
- "Unable to get location. Please enable location services."
- "Geolocation not available. Please enter location manually."
- "Failed to load nearby groups"

---

## Vấn Đề Hiện Tại

### 1. Thiếu Routing System

- ❌ Không có React Router hoặc routing library nào được cài đặt
- ❌ Tất cả navigation đang dùng state management hoặc console.log
- ❌ `ChatPage` và `NearbyGroups` không thể truy cập từ UI

### 2. Navigation TODOs

Các TODO comments trong code:

- `Home.tsx:123`: "Use proper routing when router is set up"
- `Home.tsx:198`: "Navigate to chat or show confirmation"
- `Home.tsx:322`: "Navigate to chat page"
- `NearbyGroups.tsx:67`: "Navigate to chat page"

### 3. Text Tiếng Anh

Tất cả text hiện tại đều bằng tiếng Anh, cần dịch sang tiếng Việt theo spec `002-vi-localization-uiux`.

---

## Components Cần Localization

### Common Components:

- `SOSButton`: SOS message types và labels
- `StatusSelector`: Status options (Safe, Need Help, Cannot Contact)
- `StatusIndicator`: Status descriptions
- `ConnectivityStatus`: Network status labels
- `OfflineIndicator`: Offline messages

### Group Components:

- `GroupCard`: Group type labels, distance format
- `FavoriteGroupCard`: Labels và descriptions
- `RadiusFilter`: Radius options labels
- `StatusSummary`: Status summary text

### Chat Components:

- `MessageList`: Message timestamps, empty states
- `MessageInput`: Placeholder, button labels
- `MessageBubble`: Message metadata
- `PinnedMessagesModal`: Modal title, empty state
- `SOSMessage`: SOS type labels và descriptions

---

## Kế Hoạch Cập Nhật

### Phase 1: Routing Setup (Nếu cần)

1. Cài đặt React Router hoặc routing library
2. Thiết lập routes cho các màn hình
3. Cập nhật navigation trong các component

### Phase 2: Localization

1. Tạo i18n system hoặc translation file
2. Dịch tất cả text trong 4 màn hình
3. Dịch tất cả text trong components
4. Test với người dùng Việt Nam

### Phase 3: UI/UX Optimization

1. Áp dụng color system theo spec
2. Điều chỉnh typography (font size, weight)
3. Tối ưu touch targets (button sizes, spacing)
4. Cải thiện loading states (skeleton thay vì spinner)
5. Cải thiện offline states

---

## Metrics

- **Tổng số màn hình**: 4
- **Màn hình đã kết nối routing**: 0/4 (0%)
- **Màn hình có text tiếng Việt**: 0/4 (0%)
- **Components cần localization**: ~15-20 components
- **Estimated text strings cần dịch**: ~100+ strings

---

## Notes

- App hiện tại chỉ render `Home` component trong `App.tsx`
- `CreateGroupPage` được render conditionally trong `Home` (không phải routing)
- `ChatPage` và `NearbyGroups` đã có code nhưng không thể truy cập từ UI
- Tất cả navigation hiện tại đều dùng state hoặc console.log
- Cần quyết định: Setup routing trước khi localization, hay localization trước?
