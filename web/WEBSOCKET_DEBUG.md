# WebSocket Debug Checklist

## Vấn đề: Message không đồng bộ và user khác không nhận được

### Checklist để debug:

#### 1. WebSocket Connection

- [ ] Kiểm tra WebSocket có connected không: `selectIsWebSocketConnected` trong Redux
- [ ] Kiểm tra WebSocket status: `selectWebSocketStatus` phải là `'connected'`
- [ ] Kiểm tra console logs: "WebSocket connected"
- [ ] Kiểm tra WebSocket URL: `getWebSocketUrl()` trả về đúng URL

#### 2. WebSocket Subscription

- [ ] Kiểm tra có subscribe to group không: `selectSubscribedGroupIds` phải chứa `groupId`
- [ ] Kiểm tra console logs: "Subscribed to groups"
- [ ] Kiểm tra backend nhận được subscribe message không

#### 3. Message Sending

- [ ] Kiểm tra `handleSendMessage` có được gọi không
- [ ] Kiểm tra `isWebSocketConnected` có true không khi gửi
- [ ] Kiểm tra `sendWebSocketMessageAction` có được dispatch không
- [ ] Kiểm tra `handleSendWebSocketMessage` có được gọi không
- [ ] Kiểm tra `wsService.send()` có được gọi không
- [ ] Kiểm tra console logs: "Sending WebSocket message"
- [ ] Kiểm tra message format có đúng không:
  ```typescript
  {
    type: 'send_message',
    payload: {
      groupId: string,
      content: string,
      messageType: 'text' | 'sos',
      sosType?: string,
      tags?: string[],
      deviceSequence?: number
    }
  }
  ```

#### 4. Backend Processing

- [ ] Kiểm tra backend có nhận được `send_message` không
- [ ] Kiểm tra backend có tạo message trong DB không
- [ ] Kiểm tra backend có broadcast `new_message` không
- [ ] Kiểm tra `BroadcastToGroup` có được gọi không
- [ ] Kiểm tra `broadcastToGroup` có gửi đến clients không

#### 5. Message Receiving

- [ ] Kiểm tra client có nhận được `new_message` không
- [ ] Kiểm tra `handleWebSocketMessage` có được gọi không
- [ ] Kiểm tra `receiveMessageAction` có được dispatch không
- [ ] Kiểm tra `handleReceiveMessage` có được gọi không
- [ ] Kiểm tra message có được lưu vào RxDB không
- [ ] Kiểm tra Redux state có được update không

### Potential Issues:

#### Issue 1: WebSocket không connected khi gửi message

**Symptom:** Message được tạo nhưng không gửi qua WebSocket
**Check:** `isWebSocketConnected` trong `handleSendMessage`
**Fix:** Đảm bảo WebSocket connected trước khi gửi

#### Issue 2: Message format không đúng

**Symptom:** Backend không nhận được hoặc parse sai
**Check:** Message payload format
**Fix:** Đảm bảo format đúng với backend expectation

#### Issue 3: Backend không broadcast đến sender

**Symptom:** User gửi message không thấy message của mình
**Check:** `BroadcastToGroup` có include sender không
**Fix:** Backend nên broadcast đến tất cả clients trong group, bao gồm sender

#### Issue 4: Client không subscribe đúng group

**Symptom:** Client không nhận được message từ group
**Check:** `selectSubscribedGroupIds` và backend subscription
**Fix:** Đảm bảo subscribe đúng group ID

#### Issue 5: RxDB subscription không trigger

**Symptom:** Message lưu vào RxDB nhưng UI không update
**Check:** `watchGroupMessagesSubscription` có hoạt động không
**Fix:** Đảm bảo RxDB subscription được setup đúng

### Debug Commands:

1. **Check WebSocket status in Redux:**

   ```javascript
   // In browser console
   window.__REDUX_DEVTOOLS_EXTENSION__
     ?.connect()
     .send({ type: "DISPATCH", payload: { type: "JUMP_TO_STATE" } });
   ```

2. **Check WebSocket connection:**

   ```javascript
   // In browser console
   const state = store.getState();
   console.log("WebSocket status:", state.websocket.status);
   console.log("Is connected:", state.websocket.status === "connected");
   console.log("Subscribed groups:", state.websocket.subscribedGroupIds);
   ```

3. **Check messages in Redux:**

   ```javascript
   // In browser console
   const state = store.getState();
   const groupId = "your-group-id";
   console.log("Messages:", state.messages.byGroupId[groupId]?.messages);
   ```

4. **Check RxDB messages:**
   ```javascript
   // In browser console
   const db = await window.__RXDB__;
   const messages = await db.messages
     .find({ selector: { group_id: "your-group-id" } })
     .exec();
   console.log(
     "RxDB messages:",
     messages.map((m) => m.toJSON())
   );
   ```

### Next Steps:

1. Thêm logging chi tiết vào các điểm quan trọng
2. Kiểm tra network tab để xem WebSocket messages
3. Kiểm tra backend logs để xem có nhận được messages không
4. Test với 2 clients khác nhau để verify broadcast
