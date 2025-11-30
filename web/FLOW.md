# Flow Hoạt Động Của App - Nearby Community Chat

## Tổng Quan

App sử dụng kiến trúc **offline-first** với:

- **Redux Toolkit + Redux Saga** cho state management
- **RxDB** (IndexedDB) cho local database
- **WebSocket** cho real-time messaging
- **REST API** cho data synchronization
- **Redux Persist** cho state persistence

---

## 1. App Initialization Flow

### 1.1. App Startup (`main.tsx`)

```
1. React App được mount
   ↓
2. Redux Store được khởi tạo:
   - Redux Toolkit store với Redux Saga middleware
   - Redux Persist: restore state từ localStorage
   - Redux DevTools: enabled trong development
   ↓
3. PersistGate: đợi state được restore từ localStorage
   ↓
4. App component được render
```

### 1.2. App Component (`App.tsx`)

```
1. Kiểm tra device registration:
   - Đọc device_id từ localStorage
   - Đọc jwt_token từ localStorage
   ↓
2. Nếu có device_id và token:
   → setShouldFetchDevice = true
   → useDevice hook sẽ fetch device từ API
   ↓
3. Nếu không có device_id hoặc token:
   → Hiển thị OnboardingScreen
```

---

## 2. Device Registration Flow

### 2.1. Onboarding Process

```
User nhập nickname trong OnboardingScreen
   ↓
OnboardingScreen.onComplete() được gọi
   ↓
dispatch(registerDeviceAction({ nickname }))
   ↓
deviceSaga.handleRegisterDevice():
   1. Gọi registerDeviceMutation() → POST /v1/device/register
   2. Nhận response: { device, token }
   3. Lưu token vào localStorage: jwt_token
   4. dispatch(setDevice(device))
   5. dispatch(setJWTToken(token))
   6. setToken(token) → cấu hình API client
   ↓
App.tsx useEffect:
   - device có nickname → setOnboardingComplete(true)
   - startReplication() → bắt đầu sync data
   - dispatch(connectWebSocketAction()) → kết nối WebSocket
```

### 2.2. Device Fetch Flow (khi app restart)

```
App.tsx phát hiện có device_id và token
   ↓
useDevice hook với enabled=true
   ↓
dispatch(fetchDeviceAction())
   ↓
deviceSaga.handleFetchDevice():
   1. Gọi fetchDevice() service
   2. Nếu device tồn tại:
      - dispatch(setDevice(device))
      - Lấy token từ localStorage
      - dispatch(setJWTToken(token))
      - setToken(token)
   ↓
App.tsx useEffect:
   - device có nickname → onboarding complete
   - startReplication()
   - connectWebSocket()
```

---

## 3. Redux Store & State Management

### 3.1. Store Structure

```
Redux Store
├── app (appSlice)
│   └── Device location, app settings
├── navigation (navigationSlice)
│   └── Active tab, current chat group
├── device (deviceSlice)
│   └── Device info, JWT token, registration status
├── groups (groupsSlice)
│   ├── nearbyGroups: Group[]
│   ├── favoriteGroupIds: string[]
│   └── byId: Record<groupId, GroupDetailsState>
├── messages (messagesSlice)
│   ├── byGroupId: Record<groupId, GroupMessagesState>
│   ├── receivedMessageIds: string[] (deduplication)
│   └── pendingMessages: Array<{message, timestamp, retryCount}>
└── websocket (websocketSlice)
    ├── status: 'disconnected' | 'connecting' | 'connected' | 'error'
    ├── connectedAt, disconnectedAt
    ├── lastError
    ├── reconnectAttempts
    └── subscribedGroupIds: string[]
```

### 3.2. Redux Saga Flow

```
Root Saga (rootSaga.ts)
├── deviceSaga: Device registration, fetch, update
├── groupSaga: Fetch groups, create group, favorites
├── messageSaga: Send/receive messages, sync
├── statusSaga: User status management
└── websocketSaga: WebSocket connection, messages
```

**Data Flow Pattern:**

```
Component
   ↓ dispatch(action)
Redux Saga
   ↓ call(service)
Service Layer (API/RxDB/WebSocket)
   ↓ return data
Redux Saga
   ↓ put(action)
Redux Slice (reducer)
   ↓ update state
Component re-renders (useSelector)
```

---

## 4. WebSocket Connection Flow

### 4.1. Connection Initialization

```
App.tsx hoặc ChatPage.tsx
   ↓ dispatch(connectWebSocketAction())
websocketSaga.handleConnectWebSocket():
   1. Lấy JWT token từ Redux state
   2. Tạo WebSocketService instance (singleton)
   3. setWebSocketStatus('connecting')
   4. service.connect() → WebSocket connection
   5. Khi connected:
      - setWebSocketStatus('connected')
      - setConnectedAt(timestamp)
      - resetReconnectAttempts()
      - Tạo eventChannel cho messages
      - Fork watchWebSocketMessages saga
   6. Re-subscribe to previously subscribed groups
```

### 4.2. WebSocket Message Handling

```
WebSocket receives message
   ↓
WebSocketService.onMessage callback
   ↓
eventChannel emits message
   ↓
watchWebSocketMessages saga:
   - yield take(messageChannel)
   - yield* handleWebSocketMessage(message)
   ↓
handleWebSocketMessage():
   switch (message.type):
     - 'new_message':
       → convertWebSocketMessageToDomain()
       → dispatch(receiveMessageAction(domainMessage))
     - 'message_sent':
       → handleMessageSentConfirmation()
       → updateMessageSyncStatus('synced')
     - 'message_error':
       → dispatch(setWebSocketError())
     - 'error':
       → dispatch(setWebSocketError())
```

### 4.3. Reconnection Logic

```
WebSocket connection lost
   ↓
WebSocketService.onClose event
   ↓
websocketSaga detects status = 'disconnected' or 'error'
   ↓
watchWebSocketReconnect saga:
   1. Kiểm tra reconnectAttempts < maxReconnectAttempts
   2. Kiểm tra có JWT token
   3. Tính delay với exponential backoff:
      delay = min(1000 * 2^attempts, 30000)
   4. yield call(delay)
   5. dispatch(connectWebSocketAction())
   ↓
watchWebSocketReconnectionForQueuedMessages:
   - Khi WebSocket connected
   - Lấy pendingMessages từ Redux
   - Gửi từng message qua WebSocket
   - Xóa khỏi queue sau khi gửi thành công
```

---

## 5. Message Flow

### 5.1. Sending Message Flow

```
User nhập message trong ChatPage
   ↓
MessageInput.onSend()
   ↓
dispatch(sendMessageAction({ group_id, content, message_type }))
   ↓
messageSaga.handleSendMessage():
   1. Tạo message local:
      - generateId() → message.id
      - createMessage() → lưu vào RxDB với sync_status='pending'
   2. Optimistic update:
      - dispatch(addMessage()) → thêm vào Redux state ngay
   3. Kiểm tra WebSocket connection:
      - Nếu connected:
        → dispatch(sendWebSocketMessageAction())
        → WebSocketService.send()
        → Server nhận message
        → Server gửi 'message_sent' event
        → handleMessageSentConfirmation()
        → updateMessageSyncStatus('synced')
      - Nếu không connected:
        → dispatch(queuePendingMessage())
        → Message được queue trong Redux
        → Replication sync sẽ push qua REST API
```

### 5.2. Receiving Message Flow

#### Via WebSocket (Real-time)

```
Server gửi message qua WebSocket
   ↓
WebSocketService.onMessage
   ↓
eventChannel emits
   ↓
handleWebSocketMessage() → case 'new_message'
   ↓
convertWebSocketMessageToDomain()
   ↓
dispatch(receiveMessageAction(domainMessage))
   ↓
messageSaga.handleReceiveMessage():
   1. Kiểm tra duplicate:
      - Nếu message.id đã có trong receivedMessageIds → skip
   2. dispatch(markMessageReceived(message.id))
   3. Lưu vào RxDB:
      - db.messages.upsert(message) với sync_status='synced'
   4. dispatch(addMessage()) → thêm vào Redux state
   5. RxDB subscription trigger → useMessages hook update
```

#### Via REST API (Replication Sync)

```
Replication sync chạy mỗi 5 giây
   ↓
replication-sync.ts → pullDocuments(['messages'])
   ↓
POST /v1/replicate/pull với checkpoint
   ↓
Server trả về messages mới
   ↓
Lưu vào RxDB:
   - db.messages.upsert() với sync_status='synced'
   ↓
RxDB subscription trigger
   ↓
useMessages hook update
   ↓
Component re-render với messages mới
```

### 5.3. Message Deduplication

```
Message được nhận (WebSocket hoặc REST)
   ↓
handleReceiveMessage() kiểm tra:
   - state.messages.receivedMessageIds.includes(message.id)
   ↓
Nếu đã có:
   → log.debug('Duplicate message received, skipping')
   → return (không xử lý)
   ↓
Nếu chưa có:
   → dispatch(markMessageReceived(message.id))
   → Xử lý message bình thường
   → receivedMessageIds giữ tối đa 1000 IDs (circular buffer)
```

### 5.4. Message Ordering

```
Messages được sort trong messagesSlice.addMessage():
   1. Sort theo created_at (primary)
   2. Nếu cùng timestamp → sort theo device_sequence (secondary)
   ↓
Redux state: messages được sort đúng thứ tự
   ↓
Component render messages theo thứ tự từ Redux
```

---

## 6. Data Synchronization Flow

### 6.1. Replication Sync Initialization

```
App.tsx sau khi device registered
   ↓
startReplication()
   ↓
replication.ts:
   1. Kiểm tra có JWT token
   2. migrateLegacyCheckpoint() (một lần)
   3. Kiểm tra network status:
      - Nếu online → startMessageSync()
      - Nếu offline → đợi network online
   4. Subscribe to network status:
      - offline → stopMessageSync()
      - online → startMessageSync() + triggerImmediateSync()
   5. Subscribe to visibilitychange:
      - visible → triggerImmediateSync()
```

### 6.2. Push Sync (Local → Server)

```
Replication sync cycle (mỗi 5 giây)
   ↓
pushPendingMessages():
   1. Lấy pending messages từ RxDB:
      - sync_status !== 'synced'
   2. Filter messages:
      - Chỉ push messages có sync_status='pending' hoặc 'failed'
      - Skip messages đã synced via WebSocket
      - Kiểm tra group tồn tại trên server
      - Skip optimistic groups (chưa được tạo trên server)
   3. POST /v1/replicate/push { messages: [...] }
   4. Nếu thành công:
      - Update sync_status='synced' trong RxDB
   5. Nếu thất bại:
      - Update sync_status='failed'
```

### 6.3. Pull Sync (Server → Local)

```
Replication sync cycle
   ↓
pullDocuments(['messages', 'groups', 'favorite_groups', ...]):
   1. Lấy checkpoints từ localStorage (per collection)
   2. POST /v1/replicate/pull:
      {
        collections: ['messages', 'groups', ...],
        checkpoint: { messages: '2024-01-01T00:00:00Z', ... }
      }
   3. Server trả về:
      {
        documents: [...],
        checkpoints: { messages: '2024-01-02T00:00:00Z', ... },
        has_more: false
      }
   4. Lưu documents vào RxDB:
      - db.messages.upsert()
      - db.groups.upsert()
      - ...
   5. Update checkpoints trong localStorage
   6. RxDB subscriptions trigger → UI update
```

### 6.4. WebSocket vs REST Sync Coordination

```
Message được gửi:
   ↓
Nếu WebSocket connected:
   → Gửi qua WebSocket
   → Server confirm → sync_status='synced'
   ↓
Nếu WebSocket không connected:
   → sync_status='pending'
   → Replication sync push qua REST API
   → sync_status='synced'
   ↓
Replication sync pushPendingMessages():
   → Chỉ push messages có sync_status='pending' hoặc 'failed'
   → Skip messages đã synced (sync_status='synced')
   → Tránh duplicate push
```

---

## 7. UI Rendering Flow

### 7.1. ChatPage Rendering

```
ChatPage component mount
   ↓
useEffect:
   1. Load group từ RxDB
   2. Connect WebSocket nếu chưa connected
   3. Subscribe to group khi WebSocket connected
   ↓
useMessages hook:
   1. dispatch(syncMessagesAction()) → Redux Saga fetch từ RxDB
   2. Setup RxDB subscription (reactive)
   3. Sync to Redux state
   4. Return messages cho component
   ↓
Component render:
   - ChatHeader: group info, favorite button
   - MessageList: render messages từ useMessages
   - MessageInput: input form, send button
   ↓
User gửi message:
   → dispatch(sendMessageAction())
   → Message xuất hiện ngay (optimistic update)
   → WebSocket gửi message
   → Server confirm → message được mark as synced
```

### 7.2. Message List Updates

```
Messages update từ nhiều nguồn:
   1. WebSocket real-time message
   2. Replication sync pull
   3. Local message send (optimistic)
   ↓
Tất cả đều lưu vào RxDB
   ↓
RxDB subscription trigger
   ↓
useMessages hook update
   ↓
Component re-render với messages mới
   ↓
MessageList component:
   - Render messages theo thứ tự (sorted by created_at + device_sequence)
   - Scroll to bottom khi có message mới
   - Virtual scrolling cho performance
```

---

## 8. Offline-First Architecture

### 8.1. Offline Behavior

```
Network offline
   ↓
Network status service phát hiện
   ↓
Replication sync:
   - stopMessageSync() → dừng sync cycle
   - Messages được queue trong Redux (pendingMessages)
   ↓
User gửi message:
   → Message được lưu vào RxDB với sync_status='pending'
   → dispatch(queuePendingMessage())
   → Message hiển thị ngay (optimistic)
   → Chờ network online
   ↓
Network online
   ↓
Replication sync:
   - startMessageSync() → resume sync
   - triggerImmediateSync() → sync ngay
   ↓
WebSocket:
   - Tự động reconnect
   - Gửi queued messages khi connected
   ↓
Replication sync:
   - pushPendingMessages() → push queued messages
   - pullDocuments() → pull messages mới từ server
```

### 8.2. Data Persistence

```
Redux Persist:
   - Persist slices: ['app', 'navigation', 'groups', 'device']
   - Storage: localStorage
   - Auto-restore khi app restart
   ↓
RxDB:
   - Storage: IndexedDB
   - Persist messages, groups, favorites, status
   - Auto-restore khi app restart
   ↓
localStorage:
   - device_id
   - jwt_token
   - Replication checkpoints (per collection)
```

---

## 9. Error Handling Flow

### 9.1. WebSocket Errors

```
WebSocket error xảy ra
   ↓
WebSocketService.onError
   ↓
websocketSaga.handleWebSocketError():
   1. dispatch(setWebSocketError(error))
   2. dispatch(setWebSocketStatus('error'))
   3. dispatch(incrementReconnectAttempts())
   4. Nếu chưa connecting → dispatch(connectWebSocketAction())
   ↓
watchWebSocketReconnect:
   - Detect status = 'error' hoặc 'disconnected'
   - Exponential backoff retry
   - Max attempts: 5
```

### 9.2. Message Send Errors

```
Gửi message thất bại
   ↓
messageSaga.handleSendMessage():
   - Catch error
   - dispatch(setMessagesError())
   - Message vẫn trong RxDB với sync_status='pending'
   ↓
Replication sync:
   - pushPendingMessages() sẽ retry
   - Nếu vẫn fail → sync_status='failed'
```

### 9.3. API Errors

```
API call thất bại
   ↓
Service layer catch error
   ↓
Saga catch error:
   - Log error với context
   - dispatch(setError()) trong slice
   - Component hiển thị error message
   ↓
Retry logic:
   - Redux Saga: manual retry via action dispatch
   - Replication sync: retry với backoff
```

---

## 10. Performance Optimizations

### 10.1. Selector Memoization

```
Tất cả selectors dùng createSelector:
   - Memoize kết quả
   - Chỉ re-compute khi dependencies thay đổi
   - Giảm unnecessary re-renders
```

### 10.2. Message Updates

```
useMessages hook:
   - Debounce updates (50ms)
   - Deep comparison trước khi update
   - Memoize messages array
   - Chỉ update khi messages thực sự thay đổi
```

### 10.3. RxDB Subscriptions

```
RxDB subscriptions:
   - Reactive updates chỉ khi data thay đổi
   - Debounce để batch updates
   - Unsubscribe khi component unmount
```

---

## 11. Complete User Journey Example

### Scenario: User gửi message trong group chat

```
1. User mở app
   → App.tsx check device registration
   → Device đã registered → load device
   → startReplication()
   → connectWebSocket()

2. User navigate to ChatPage
   → ChatPage mount
   → Load group từ RxDB
   → useMessages() fetch messages
   → Connect WebSocket (nếu chưa)
   → Subscribe to group

3. User nhập message và gửi
   → MessageInput.onSend()
   → dispatch(sendMessageAction())
   → messageSaga.handleSendMessage():
      - Tạo message local (ID, timestamp)
      - Lưu vào RxDB (sync_status='pending')
      - Optimistic update Redux
      - Gửi qua WebSocket
   → Message hiển thị ngay trong UI

4. Server nhận message
   → Broadcast đến tất cả subscribers
   → Gửi 'message_sent' confirmation
   → websocketSaga.handleMessageSentConfirmation():
      - Update sync_status='synced' trong RxDB

5. Other users nhận message
   → WebSocket 'new_message' event
   → websocketSaga.handleWebSocketMessage()
   → messageSaga.handleReceiveMessage():
      - Check duplicate
      - Lưu vào RxDB (sync_status='synced')
      - Update Redux state
   → useMessages hook update
   → MessageList re-render
   → Message xuất hiện trong UI

6. Offline scenario
   → User gửi message khi offline
   → Message queue trong Redux (pendingMessages)
   → Network online
   → WebSocket reconnect
   → watchWebSocketReconnectionForQueuedMessages:
      - Gửi queued messages
   → Replication sync:
      - pushPendingMessages() (backup)
```

---

## 12. Key Design Patterns

### 12.1. Offline-First

- Tất cả data lưu local (RxDB)
- UI render từ local data
- Sync với server ở background
- Optimistic updates cho UX tốt

### 12.2. Dual Transport

- WebSocket: real-time, low latency
- REST API: reliable, fallback
- Automatic failover
- Deduplication để tránh duplicate

### 12.3. Saga Pattern

- Side effects trong sagas
- Components chỉ dispatch actions
- Centralized async logic
- Easy to test

### 12.4. Reactive Updates

- RxDB subscriptions cho real-time
- Redux state cho UI state
- Redux Persist cho state caching
- Tất cả sync với nhau

---

## Tóm Tắt Flow Chính

```
App Start
   ↓
Device Check → Onboarding (nếu cần)
   ↓
Device Registered → Start Replication → Connect WebSocket
   ↓
User Navigate → Load Data từ RxDB → Subscribe WebSocket
   ↓
User Action → Dispatch Action → Saga → Service → Update State
   ↓
State Change → Component Re-render → UI Update
   ↓
Background Sync → Replication Sync → Keep Data Fresh
```

---

**Lưu ý:** Flow này mô tả architecture hiện tại sau khi đã migrate từ Zustand sang Redux/Redux Saga và implement WebSocket real-time messaging.
