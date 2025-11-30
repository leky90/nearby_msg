import { call, put, takeEvery } from 'redux-saga/effects';
import type { UserStatus, StatusType } from '@/domain/user_status';
import { updateStatusMutation, fetchStatus } from '@/services/status-service';
import { setUserStatus } from '../slices/appSlice';
import { log } from '@/lib/logging/logger';

// Action types
const UPDATE_USER_STATUS = 'status/updateUserStatus';
const FETCH_USER_STATUS = 'status/fetchUserStatus';

// Action creators
export const updateUserStatusAction = (variables: {
  statusType: StatusType;
  description?: string;
}) => ({
  type: UPDATE_USER_STATUS,
  payload: variables,
});
export const fetchUserStatusAction = () => ({ type: FETCH_USER_STATUS });

// Sagas
function* watchUpdateUserStatus() {
  yield takeEvery(UPDATE_USER_STATUS, handleUpdateUserStatus);
}

function* handleUpdateUserStatus(action: {
  type: string;
  payload: { statusType: StatusType; description?: string };
}) {
  try {
    const status: UserStatus = yield call(updateStatusMutation, action.payload);
    yield put(setUserStatus(status));
  } catch (error) {
    log.error('Failed to update user status', error);
  }
}

function* watchFetchUserStatus() {
  yield takeEvery(FETCH_USER_STATUS, handleFetchUserStatus);
}

function* handleFetchUserStatus() {
  try {
    const status: UserStatus | null = yield call(fetchStatus);
    yield put(setUserStatus(status));
  } catch (error) {
    log.error('Failed to fetch user status', error);
    yield put(setUserStatus(null));
  }
}

// Root saga
export function* statusSaga() {
  yield watchUpdateUserStatus();
  yield watchFetchUserStatus();
}
