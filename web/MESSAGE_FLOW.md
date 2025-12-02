# Message Flow Documentation

## Flow kiểm tra

### 1. Vào group chat -> lấy messages từ RxDB -> lưu vào local state -> hiển thị UI

**Flow:**
1. `ChatPage` mount -> `MessageList` mount
2. `MessageList` gọi `useMessages({ groupId, reactive: true })`
3. `useMessages` hook:
   - Dispatch `syncMessagesAction(groupId)` khi mount
   - Dispatch `startMessageSubscriptionAction(groupId, limit)` để bật reactive subscription
4. `handleSyncMessages` saga:
   - Load messages từ RxDB: `db.messages.find({ selector: { group_id: groupId } })`
   - Update Redux state: `setMessages({ groupId, messages })`
5. `watchGroupMessagesSubscription` saga:
   - Tạo RxDB subscription: `watchGroupMessages(groupId, callback)`
   - Khi RxDB có thay đổi -> callback được gọi -> update Redux state
6. `MessageList` đọc messages từ Redux state qua `useMessages` hook
7. UI hiển thị messages

**Files:**
- `web/src/features/messages/hooks/useMessages.ts` - Hook quản lý messages
- `web/src/features/messages/store/saga.ts` - `handleSyncMessages`, `watchGroupMessagesSubscription`
- `web/src/shared/services/db.ts` - `watchGroupMessages` function

**Status:** ✅ Đúng

---

### 2. Vào group chat -> khởi tạo subscribe lắng nghe WebSocket

**Flow:**
1. `ChatPage` mount -> `ChatContent` mount -> `WebSocketStatusIndicator` mount
2. `WebSocketStatusIndicator`:
   - Lấy `groupId` từ route params (`useParams`)
   - Lấy `jwtToken` từ Redux state
   - `useEffect`: Nếu có `jwtToken` và `groupId` nhưng WebSocket chưa connected -> dispatch `connectWebSocketAction()`
   - `useEffect`: Khi WebSocket connected và có `groupId` -> dispatch `subscribeToGroupsAction([groupId])`
3. WebSocket saga xử lý connection và subscription

**Files:**
- `web/src/features/websocket/components/WebSocketStatusIndicator.tsx` - Component quản lý WebSocket connection
- `web/src/features/websocket/store/saga.ts` - WebSocket connection logic

**Status:** ✅ Đúng

---

### 3. Nhập message -> lưu vào RxDB -> cập nhật state -> hiển thị lên UI -> push vào WebSocket gửi đến server

**Flow:**
1. User nhập message trong `MessageInput`
2. User click Send -> `handleSend` gọi `onSend(content)`
3. `ChatPage.handleSendMessage` dispatch `sendTextMessageAction(groupId, content)`
4. `handleSendMessage` saga:
   - **Lưu vào RxDB**: `createMessage(request)` -> `persistMessage(message)` -> `db.messages.insert(message)` với `sync_status='pending'`
   - **Cập nhật Redux state**: `addMessage({ groupId, message })` -> Redux state update ngay lập tức (optimistic update)
   - **Hiển thị UI**: Redux state update -> `useMessages` hook re-render -> `MessageList` hiển thị message mới
   - **Push WebSocket**: Nếu WebSocket connected -> `sendWebSocketMessageAction({ type: 'send_message', payload: {...} })`
   - Nếu WebSocket không connected -> message có `sync_status='pending'`, sẽ được sync qua REST API replication

**Files:**
- `web/src/features/messages/components/MessageInput.tsx` - Input component
- `web/src/pages/ChatPage.tsx` - `handleSendMessage`
- `web/src/features/messages/store/saga.ts` - `handleSendMessage`
- `web/src/features/messages/services/message-service.ts` - `createMessage`, `persistMessage`

**Status:** ✅ Đúng

**Note:** Message được lưu vào RxDB trước, sau đó update Redux state. RxDB subscription cũng sẽ trigger nhưng Redux đã có message rồi nên không duplicate.

---

### 4. Server nhận message -> emit message đến các client subscribe group chat

**Flow:**
1. Server nhận message qua WebSocket
2. Server xử lý và lưu vào database
3. Server emit `new_message` event đến tất cả clients đã subscribe group đó

**Files:**
- Backend: `api/internal/service/websocket_service.go`

**Status:** ✅ Backend xử lý (không cần kiểm tra frontend)

---

### 5. Client nhận được message -> lưu vào RxDB -> cập nhật state -> hiển thị lên UI

**Flow:**
1. WebSocket nhận `new_message` event từ server
2. `handleWebSocketMessage` saga xử lý:
   - Convert WebSocket message format sang domain Message format
   - Dispatch `receiveMessageAction(domainMessage)`
3. `handleReceiveMessage` saga:
   - **Kiểm tra duplicate**: Check `receivedMessageIds` để tránh duplicate
   - **Lưu vào RxDB**: `db.messages.upsert(message)` với `sync_status='synced'`
   - **Cập nhật Redux state**: `addMessage({ groupId, message })`
4. RxDB subscription trigger:
   - `watchGroupMessages` callback được gọi với messages mới
   - `watchGroupMessagesSubscription` saga update Redux state: `setMessages({ groupId, messages })`
5. **Hiển thị UI**: Redux state update -> `useMessages` hook re-render -> `MessageList` hiển thị message mới

**Files:**
- `web/src/features/websocket/store/saga.ts` - `handleWebSocketMessage`, `convertWebSocketMessageToDomain`
- `web/src/features/messages/store/saga.ts` - `handleReceiveMessage`
- `web/src/shared/services/db.ts` - `watchGroupMessages`

**Status:** ✅ Đúng

**Note:** Message được lưu vào RxDB trước, sau đó update Redux state. RxDB subscription cũng sẽ trigger nhưng Redux đã có message rồi nên không duplicate.

---

## Tóm tắt

### Data Flow:
```
RxDB (Single Source of Truth)
  ↓
Redux State (UI State)
  ↓
React Components (UI)
```

### Message Send Flow:
```
User Input → createMessage → RxDB (pending) → Redux (optimistic) → UI
                                                      ↓
                                              WebSocket → Server
```

### Message Receive Flow:
```
Server → WebSocket → receiveMessage → RxDB (synced) → Redux → UI
                                              ↓
                                    RxDB Subscription → Redux (reactive)
```

### Key Points:
1. **RxDB là single source of truth**: Tất cả messages được lưu trong RxDB
2. **Redux state là UI state**: Redux chỉ chứa data để hiển thị UI, sync từ RxDB
3. **RxDB subscription**: Tự động update Redux khi RxDB có thay đổi
4. **Optimistic updates**: Khi gửi message, update Redux ngay lập tức để UX tốt hơn
5. **WebSocket first, REST fallback**: Ưu tiên WebSocket, nếu không có thì dùng REST API replication

---

## Potential Issues

### Issue 1: Double Redux Update
Khi gửi message:
- `handleSendMessage` gọi `addMessage` -> Redux update
- Message lưu vào RxDB -> RxDB subscription trigger -> `setMessages` -> Redux update lại

**Impact:** Có thể gây re-render không cần thiết, nhưng không ảnh hưởng functionality.

**Solution:** Có thể optimize bằng cách check xem message đã có trong Redux chưa trước khi update.

### Issue 2: Duplicate Prevention
`handleReceiveMessage` có check duplicate qua `receivedMessageIds`, nhưng khi gửi message thì không check.

**Impact:** Nếu WebSocket gửi lại message đã gửi, có thể bị duplicate.

**Solution:** Cần check duplicate trong `handleSendMessage` hoặc dựa vào message ID.

---

## Conclusion

Flow hiện tại **đúng** và hoạt động tốt. Có một số điểm có thể optimize nhưng không ảnh hưởng functionality.
