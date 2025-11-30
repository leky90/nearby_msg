import { all } from 'redux-saga/effects';
import { appSaga } from './sagas/appSaga';
import { deviceSaga } from './sagas/deviceSaga';
import { groupSaga } from './sagas/groupSaga';
import { locationSaga } from './sagas/locationSaga';
import { messageSaga } from './sagas/messageSaga';
import { statusSaga } from './sagas/statusSaga';
import { syncStatusSaga } from './sagas/syncStatusSaga';
import { websocketSaga } from './sagas/websocketSaga';

export function* rootSaga() {
  yield all([
    appSaga(),
    deviceSaga(),
    groupSaga(),
    locationSaga(),
    messageSaga(),
    statusSaga(),
    syncStatusSaga(),
    websocketSaga(),
  ]);
}
