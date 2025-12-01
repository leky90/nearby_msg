/**
 * Messages Feature Module
 * Public API exports for the messages feature
 */

// Hooks
export { useMessages } from "./hooks/useMessages";

// Services
export { createMessage, createSOSMessage, checkSOSCooldown } from "./services/message-service";
export { pinMessage, unpinMessage, getPinnedMessages } from "./services/pin-service";

// Store
export { default as messagesSlice } from "./store/slice";
export { messageSaga } from "./store/saga";

// Types
export type * from "./types";
