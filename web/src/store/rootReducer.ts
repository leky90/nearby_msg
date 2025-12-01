import { combineReducers } from '@reduxjs/toolkit';
import appReducer from '@/features/navigation/store/appSlice';
import navigationReducer from '@/features/navigation/store/slice';
import messagesReducer from '@/features/messages/store/slice';
import groupsReducer from '@/features/groups/store/slice';
import deviceReducer from '@/features/device/store/slice';
import websocketReducer from '@/features/websocket/store/slice';
import syncStatusReducer from '@/features/status/store/slice';

const rootReducer = combineReducers({
  app: appReducer,
  navigation: navigationReducer,
  messages: messagesReducer,
  groups: groupsReducer,
  device: deviceReducer,
  websocket: websocketReducer,
  syncStatus: syncStatusReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
