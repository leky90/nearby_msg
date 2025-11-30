import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import rootReducer, { type RootState } from './rootReducer';
import { rootSaga } from './rootSaga';

// Redux Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['app', 'navigation', 'groups', 'device'], // Only persist these slices
  // Selective persistence for app slice
  transforms: [],
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create saga middleware
const sagaMiddleware = createSagaMiddleware();

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(sagaMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Create persistor
export const persistor = persistStore(store);

// Run root saga
sagaMiddleware.run(rootSaga);

// Export types
export type AppDispatch = typeof store.dispatch;
export type { RootState };
