import { all } from 'redux-saga/effects';
import { deviceSaga } from './sagas/deviceSaga';
import { groupSaga } from './sagas/groupSaga';
import { messageSaga } from './sagas/messageSaga';
import { statusSaga } from './sagas/statusSaga';
import { websocketSaga } from './sagas/websocketSaga';

export function* rootSaga() {
  yield all([
    deviceSaga(),
    groupSaga(),
    messageSaga(),
    statusSaga(),
    websocketSaga(),
  ]);
}
