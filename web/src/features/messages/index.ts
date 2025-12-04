/**
 * Messages Feature Module
 * Public API exports for the messages feature
 */

// Hooks
export { useMessages } from "./hooks/useMessages";
export { useChatGroup } from "./hooks/useChatGroup";

// Services
export {
  createMessage,
  createSOSMessage,
  checkSOSCooldown,
} from "./services/message-service";
export {
  pinMessage,
  unpinMessage,
  getPinnedMessages,
} from "./services/pin-service";
export { sendSOSToAllGroups } from "./services/sos-service";

// Store
export { default as messagesSlice } from "./store/slice";
export { messageSaga } from "./store/saga";

// Types
export type * from "./types";
