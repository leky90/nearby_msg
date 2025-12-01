import { all } from 'redux-saga/effects';
import { appSaga } from '@/features/navigation/store/appSaga';
import { deviceSaga } from '@/features/device/store/saga';
import { groupSaga } from '@/features/groups/store/groupSaga';
import { locationSaga } from '@/features/groups/store/locationSaga';
import { messageSaga } from '@/features/messages/store/saga';
import { statusSaga } from '@/features/status/store/statusSaga';
import { syncStatusSaga } from '@/features/status/store/syncStatusSaga';
import { websocketSaga } from '@/features/websocket/store/saga';

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
