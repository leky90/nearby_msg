import { all } from 'redux-saga/effects';
import { deviceSaga } from './sagas/deviceSaga';
import { groupSaga } from './sagas/groupSaga';
import { locationSaga } from './sagas/locationSaga';
import { messageSaga } from './sagas/messageSaga';
import { statusSaga } from './sagas/statusSaga';
import { websocketSaga } from './sagas/websocketSaga';

export function* rootSaga() {
  yield all([
    deviceSaga(),
    groupSaga(),
    locationSaga(),
    messageSaga(),
    statusSaga(),
    websocketSaga(),
  ]);
}
