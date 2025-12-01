/**
 * Groups Feature Module
 * Public API exports for the groups feature
 */

// Hooks
export { useGroups } from "./hooks/useGroups";
export { useGroupDetails } from "./hooks/useGroupDetails";
export { useFavorites } from "./hooks/useFavorites";
export { useFavoriteToggle } from "./hooks/useFavoriteToggle";
export { useNearbyGroups } from "./hooks/useNearbyGroups";

// Services
export { discoverNearbyGroups, createGroup, getDeviceCreatedGroup } from "./services/group-service";
export { addFavorite, removeFavorite, isFavorited, fetchFavorites } from "./services/favorite-service";
export { reverseGeocode } from "./services/geocoding-service";
export { getCurrentLocation } from "./services/location-service";

// Store
export { default as groupsSlice } from "./store/slice";
export { groupSaga } from "./store/groupSaga";
export { locationSaga } from "./store/locationSaga";

// Types
export type * from "./types";
