# API Mapping Report: Backend vs Frontend

**Generated:** 2025-01-27  
**Purpose:** Map all backend API endpoints to frontend usage and identify unused/missing APIs

---

## Backend API Endpoints

### 1. Health Check

- **GET** `/health`
- **Auth:** None
- **Frontend Usage:** ❌ Not used (backend-only health check)

### 2. Device Management

#### 2.1 Register Device

- **POST** `/v1/device/register`
- **Auth:** None (public endpoint)
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/device-service.ts`
  - Function: `registerDeviceMutation()`
  - Auto-triggered on app startup via `useDevice()` hook

#### 2.2 Get Device

- **GET** `/v1/device?id={device_id}`
- **Auth:** Optional (works without auth, but returns 401 if device not found)
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/device-service.ts`
  - Function: `fetchDevice()`
  - Called automatically via TanStack Query

#### 2.3 Update Device

- **PATCH** `/v1/device?id={device_id}`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/device-service.ts`
  - Function: `updateDeviceNickname()`
  - Used in `useDevice()` hook for nickname updates

### 3. Groups

#### 3.1 Create Group

- **POST** `/v1/groups`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/group-service.ts`
  - Function: `createGroup()`
  - Used in `CreateGroupForm` component

#### 3.2 Discover Nearby Groups

- **GET** `/v1/groups/nearby?latitude={lat}&longitude={lon}&radius={radius}`
- **Auth:** Optional (public endpoint)
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/group-service.ts`
  - Function: `discoverNearbyGroups()`
  - Used in `NearbyGroups` page

#### 3.3 Get Group

- **GET** `/v1/groups/{group_id}` or `/v1/groups?id={group_id}`
- **Auth:** Optional
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/group-service.ts`
  - Function: `getGroup()`
  - Used in `Home.tsx` for favorite groups details

#### 3.4 Suggest Group Name and Type

- **GET** `/v1/groups/suggest?latitude={lat}&longitude={lon}`
- **Auth:** Optional (public endpoint)
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/group-service.ts`
  - Function: `suggestGroupNameAndType()`
  - Used in `CreateGroupForm` component

### 4. Favorites

#### 4.1 Add Favorite

- **POST** `/v1/groups/{group_id}/favorite`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/favorite-service.ts`
  - Function: `addFavorite()`
  - Used in `ChatHeader` and `FavoriteGroupCard` components

#### 4.2 Remove Favorite

- **DELETE** `/v1/groups/{group_id}/favorite`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/favorite-service.ts`
  - Function: `removeFavorite()`
  - Used in `Home.tsx` for unfavorite action

#### 4.3 Get Favorites

- **GET** `/v1/favorites` (if exists) or via replication
- **Auth:** Required
- **Frontend Usage:** ⚠️ Not directly used
  - File: `web/src/services/favorite-service.ts`
  - Function: `fetchFavorites()` - reads from RxDB cache only
  - **Note:** No direct API endpoint exists, favorites are synced via replication

### 5. Replication

#### 5.1 Push Messages

- **POST** `/v1/replicate/push`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/replication-sync.ts`
  - Function: `pushPendingMessages()`
  - Called automatically by replication service

#### 5.2 Pull Messages/Documents

- **POST** `/v1/replicate/pull`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/replication-sync.ts`
  - Function: `pullDocuments()`, `pullDocumentsFromCollections()`
  - Called automatically by replication service
  - **Note:** Supports both legacy format (messages-only) and new format (multi-collection)
  - Collections synced: messages, groups, favorite_groups, pinned_messages, user_status

### 6. Message Pinning

#### 6.1 Pin Message

- **POST** `/v1/messages/{message_id}/pin`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/pin-service.ts`
  - Function: `pinMessage()`
  - Used in `MessageBubble` component

#### 6.2 Unpin Message

- **DELETE** `/v1/messages/{message_id}/pin`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/pin-service.ts`
  - Function: `unpinMessage()`
  - Used in `MessageBubble` component

#### 6.3 Get Pinned Messages

- **GET** `/v1/groups/{group_id}/pinned`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/pin-service.ts`
  - Function: `getPinnedMessages()`
  - Used in `PinnedMessagesModal` component

### 7. User Status

#### 7.1 Update Status

- **PUT** `/v1/status`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/status-service.ts`
  - Function: `updateStatusMutation()`
  - Used in `StatusSelector` component

#### 7.2 Get Status

- **GET** `/v1/status`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/status-service.ts`
  - Function: `fetchStatus()`
  - Called automatically via TanStack Query in `Home.tsx`

#### 7.3 Get Group Status Summary

- **GET** `/v1/groups/{group_id}/status-summary`
- **Auth:** Required
- **Frontend Usage:** ✅ Used
  - File: `web/src/services/status-service.ts`
  - Function: `getGroupStatusSummary()`
  - Used in `StatusSummary` component

---

## Summary

### ✅ All APIs Used (17/17)

- Device: 3/3 endpoints used
- Groups: 4/4 endpoints used
- Favorites: 2/2 endpoints used (GET favorites via replication)
- Replication: 2/2 endpoints used
- Messages: 3/3 endpoints used
- Status: 2/2 endpoints used

### ⚠️ Missing APIs (0)

- All frontend needs are covered by existing endpoints

### 📝 Notes

1. **Favorites GET endpoint:** Frontend uses RxDB cache + replication sync instead of direct GET endpoint. This is acceptable for offline-first architecture.

2. **Health check:** Not needed in frontend (backend monitoring only).

3. **API Coverage:** 100% (17/17 endpoints used)

---

## Recommendations

1. **Consider adding GET /favorites endpoint:**
   - Currently favorites are only synced via replication
   - Direct GET endpoint could be useful for initial load
   - **Priority:** Low (replication works fine)

2. **All other APIs are properly utilized** ✅
