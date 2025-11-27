# Nearby Community Chat API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:8080/v1` (development)  
**Production URL:** `https://api.nearby-msg.example.com/v1`

## Overview

REST API for offline-first community chat PWA for disaster scenarios. Enables location-based group discovery, messaging, and emergency SOS features.

## Authentication

Most endpoints require JWT Bearer token authentication. The token is obtained when registering a device.

**Header Format:**
```
Authorization: Bearer <jwt_token>
```

## Base Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
- `200 OK` - Server is healthy

---

## Device Management

### Register Device

**POST** `/v1/device/register`

Register a new device or retrieve existing device information. Device ID should persist across app reinstalls.

**Request Body:**
```json
{
  "device_id": "string (optional, UUID)",
  "nickname": "string (optional, 1-50 chars)"
}
```

**Response:**
```json
{
  "id": "uuid",
  "nickname": "string",
  "public_key": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `200 OK` - Device registered or retrieved
- `400 Bad Request` - Invalid request
- `500 Internal Server Error` - Server error

### Get Device

**GET** `/v1/device/{device_id}`

Get device information.

**Parameters:**
- `device_id` (path, required) - Device UUID

**Response:**
```json
{
  "id": "uuid",
  "nickname": "string",
  "public_key": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `200 OK` - Device found
- `404 Not Found` - Device not found

### Update Device

**PATCH** `/v1/device/{device_id}`

Update device nickname.

**Parameters:**
- `device_id` (path, required) - Device UUID

**Request Body:**
```json
{
  "nickname": "string (required, 1-50 chars)"
}
```

**Response:**
```json
{
  "id": "uuid",
  "nickname": "string",
  "public_key": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `200 OK` - Device updated
- `400 Bad Request` - Invalid request
- `404 Not Found` - Device not found

---

## Groups

### Create Group

**POST** `/v1/groups`

Create a new community group. Each device can create maximum one group.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string (required, 1-100 chars)",
  "type": "neighborhood | ward | district | apartment | other",
  "latitude": "number (required, -90 to 90)",
  "longitude": "number (required, -180 to 180)",
  "region_code": "string (optional, 2-10 chars)"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "string",
  "type": "string",
  "latitude": "number",
  "longitude": "number",
  "region_code": "string | null",
  "creator_device_id": "uuid",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `201 Created` - Group created
- `400 Bad Request` - Invalid request
- `409 Conflict` - Device has already created a group
- `500 Internal Server Error` - Server error

### Discover Nearby Groups

**GET** `/v1/groups/nearby`

Find groups within specified radius from given location. Returns groups sorted by distance (nearest first).

**Query Parameters:**
- `latitude` (required) - Latitude (-90 to 90)
- `longitude` (required) - Longitude (-180 to 180)
- `radius` (required) - Radius in meters: `500`, `1000`, or `2000`
- `limit` (optional) - Maximum results (default: 50, max: 100)

**Response:**
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "string",
      "type": "string",
      "latitude": "number",
      "longitude": "number",
      "distance": "number (meters)",
      "activity": "number"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid parameters

### Get Group

**GET** `/v1/groups/{group_id}`

Get group information.

**Parameters:**
- `group_id` (path, required) - Group UUID

**Response:**
```json
{
  "id": "uuid",
  "name": "string",
  "type": "string",
  "latitude": "number",
  "longitude": "number",
  "region_code": "string | null",
  "creator_device_id": "uuid",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `200 OK` - Group found
- `404 Not Found` - Group not found

### Suggest Group Name and Type

**GET** `/v1/groups/suggest`

Get suggested group name and type based on location.

**Query Parameters:**
- `latitude` (required) - Latitude
- `longitude` (required) - Longitude

**Response:**
```json
{
  "suggested_name": "string",
  "suggested_type": "neighborhood | ward | district | apartment | other"
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid parameters

---

## Favorites

### Add Favorite

**POST** `/v1/groups/{group_id}/favorite`

Mark a group as favorite.

**Authentication:** Required

**Parameters:**
- `group_id` (path, required) - Group UUID

**Response:**
```json
{
  "id": "uuid",
  "device_id": "uuid",
  "group_id": "uuid",
  "created_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `201 Created` - Group favorited
- `400 Bad Request` - Invalid request
- `404 Not Found` - Group not found

### Remove Favorite

**DELETE** `/v1/groups/{group_id}/favorite`

Unfavorite a group.

**Authentication:** Required

**Parameters:**
- `group_id` (path, required) - Group UUID

**Status Codes:**
- `204 No Content` - Group unfavorited
- `404 Not Found` - Group not found

---

## Replication

### Push Messages

**POST** `/v1/replicate/push`

Send pending changes from client to server. Accepts batch of messages.

**Authentication:** Required

**Rate Limit:** 10 messages per minute per device

**Request Body:**
```json
{
  "device_id": "uuid",
  "messages": [
    {
      "id": "uuid",
      "group_id": "uuid",
      "content": "string (1-500 chars)",
      "message_type": "text | sos | status_update",
      "sos_type": "medical | flood | fire | missing_person (if message_type is sos)",
      "tags": ["string"],
      "device_sequence": "number",
      "created_at": "ISO 8601 datetime"
    }
  ]
}
```

**Response:**
- `204 No Content` - Messages pushed successfully

**Status Codes:**
- `204 No Content` - Success
- `400 Bad Request` - Invalid request
- `429 Too Many Requests` - Rate limit exceeded

### Pull Messages

**POST** `/v1/replicate/pull`

Request new documents from server since last checkpoint.

**Authentication:** Required

**Request Body:**
```json
{
  "checkpoint": "string (optional, last checkpoint from previous pull)",
  "collections": ["messages", "groups", "favorite_groups", "pinned_messages", "user_status"],
  "group_ids": ["uuid"] (optional, specific groups to pull messages for)
}
```

**Response:**
```json
{
  "documents": [
    {
      "collection": "string",
      "document": {}
    }
  ],
  "checkpoint": "string (new checkpoint for next pull)",
  "has_more": "boolean"
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid request

---

## Message Pinning

### Pin Message

**POST** `/v1/messages/{message_id}/pin`

Pin a message in a group.

**Authentication:** Required

**Parameters:**
- `message_id` (path, required) - Message UUID

**Request Body:**
```json
{
  "tag": "string (optional, 1-50 chars)"
}
```

**Response:**
```json
{
  "id": "uuid",
  "message_id": "uuid",
  "group_id": "uuid",
  "device_id": "uuid",
  "pinned_at": "ISO 8601 datetime",
  "tag": "string | null"
}
```

**Status Codes:**
- `201 Created` - Message pinned
- `400 Bad Request` - Invalid request
- `404 Not Found` - Message not found

### Unpin Message

**DELETE** `/v1/messages/{message_id}/pin`

Unpin a message.

**Authentication:** Required

**Parameters:**
- `message_id` (path, required) - Message UUID

**Status Codes:**
- `204 No Content` - Message unpinned
- `404 Not Found` - Message not found

### Get Pinned Messages

**GET** `/v1/groups/{group_id}/pinned`

Get all pinned messages for a group.

**Authentication:** Required

**Parameters:**
- `group_id` (path, required) - Group UUID

**Response:**
```json
{
  "pinned_messages": [
    {
      "id": "uuid",
      "message_id": "uuid",
      "group_id": "uuid",
      "device_id": "uuid",
      "pinned_at": "ISO 8601 datetime",
      "tag": "string | null"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Group not found

---

## User Status

### Update Status

**PUT** `/v1/status`

Update user's safety status.

**Authentication:** Required

**Request Body:**
```json
{
  "status_type": "safe | need_help | cannot_contact",
  "description": "string (optional, 1-200 chars)"
}
```

**Response:**
```json
{
  "id": "uuid",
  "device_id": "uuid",
  "status_type": "string",
  "description": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `200 OK` - Status updated
- `400 Bad Request` - Invalid request

### Get Status

**GET** `/v1/status`

Get user's current safety status.

**Authentication:** Required

**Response:**
```json
{
  "id": "uuid",
  "device_id": "uuid",
  "status_type": "string",
  "description": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

**Status Codes:**
- `200 OK` - Status found
- `404 Not Found` - No status set

### Clear Status

**DELETE** `/v1/status`

Clear user's safety status.

**Authentication:** Required

**Status Codes:**
- `204 No Content` - Status cleared

### Get Group Status Summary

**GET** `/v1/groups/{group_id}/status-summary`

Get status summary for a group (count of users by status type).

**Authentication:** Required

**Parameters:**
- `group_id` (path, required) - Group UUID

**Response:**
```json
{
  "safe": "integer",
  "need_help": "integer",
  "cannot_contact": "integer"
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Group not found

---

## Data Models

### Device
```json
{
  "id": "uuid",
  "nickname": "string (1-50 chars)",
  "public_key": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

### Group
```json
{
  "id": "uuid",
  "name": "string (1-100 chars)",
  "type": "neighborhood | ward | district | apartment | other",
  "latitude": "number (-90 to 90)",
  "longitude": "number (-180 to 180)",
  "region_code": "string | null (2-10 chars)",
  "creator_device_id": "uuid",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

### Message
```json
{
  "id": "uuid",
  "group_id": "uuid",
  "device_id": "uuid",
  "content": "string (1-500 chars)",
  "message_type": "text | sos | status_update",
  "sos_type": "medical | flood | fire | missing_person (if message_type is sos)",
  "tags": ["string"],
  "pinned": "boolean",
  "created_at": "ISO 8601 datetime",
  "synced_at": "ISO 8601 datetime | null"
}
```

### FavoriteGroup
```json
{
  "id": "uuid",
  "device_id": "uuid",
  "group_id": "uuid",
  "created_at": "ISO 8601 datetime"
}
```

### PinnedMessage
```json
{
  "id": "uuid",
  "message_id": "uuid",
  "group_id": "uuid",
  "device_id": "uuid",
  "pinned_at": "ISO 8601 datetime",
  "tag": "string | null (1-50 chars)"
}
```

### UserStatus
```json
{
  "id": "uuid",
  "device_id": "uuid",
  "status_type": "safe | need_help | cannot_contact",
  "description": "string | null (1-200 chars)",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

### Error
```json
{
  "error": "string",
  "message": "string",
  "details": {}
}
```

---

## Rate Limits

- **Message sending:** 10 messages per minute per device
- **SOS messages:** 30-second cooldown between SOS messages

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {}
}
```

**Common HTTP Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success (no response body)
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- **Source:** `specs/001-nearby-msg/contracts/openapi.yaml`
- **View online:** Use tools like Swagger UI or Redoc to view the interactive documentation

---

## Examples

### Register Device and Get Token

```bash
curl -X POST http://localhost:8080/v1/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "My Device"
  }'
```

### Discover Nearby Groups

```bash
curl -X GET "http://localhost:8080/v1/groups/nearby?latitude=10.762622&longitude=106.660172&radius=1000" \
  -H "Authorization: Bearer <token>"
```

### Send a Message

```bash
curl -X POST http://localhost:8080/v1/replicate/push \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "<device_id>",
    "messages": [{
      "id": "<message_id>",
      "group_id": "<group_id>",
      "content": "Hello, everyone!",
      "message_type": "text",
      "device_sequence": 1,
      "created_at": "2024-01-01T00:00:00Z"
    }]
  }'
```

### Update Safety Status

```bash
curl -X PUT http://localhost:8080/v1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status_type": "safe",
    "description": "All good here!"
  }'
```

---

## Support

For API support, see the main project documentation or contact the development team.

