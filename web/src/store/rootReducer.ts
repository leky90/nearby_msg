import { combineReducers } from '@reduxjs/toolkit';
import appReducer from './slices/appSlice';
import navigationReducer from './slices/navigationSlice';
import messagesReducer from './slices/messagesSlice';
import groupsReducer from './slices/groupsSlice';
import deviceReducer from './slices/deviceSlice';
import websocketReducer from './slices/websocketSlice';

const rootReducer = combineReducers({
  app: appReducer,
  navigation: navigationReducer,
  messages: messagesReducer,
  groups: groupsReducer,
  device: deviceReducer,
  websocket: websocketReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
