import { useSelector } from 'react-redux';
import type { Group } from "@/shared/domain/group";
import {
  selectNearbyGroups,
  selectNearbyGroupsLoading,
  selectNearbyGroupsError,
  selectNearbyGroupsDistances,
} from "@/features/groups/store/slice";
import type { RootState } from "@/store";

export interface UseNearbyGroupsResult {
  /** Nearby groups array */
  groups: Group[];
  /** Distances array (corresponding to groups) */
  distances: number[];
  /** Whether groups are loading */
  isLoading: boolean;
  /** Error if any */
  error: string | null;
}

export function useNearbyGroups(): UseNearbyGroupsResult {
  const groups = useSelector((state: RootState) => selectNearbyGroups(state));
  const distances = useSelector((state: RootState) =>
    selectNearbyGroupsDistances(state)
  );
  const isLoading = useSelector((state: RootState) =>
    selectNearbyGroupsLoading(state)
  );
  const error = useSelector((state: RootState) =>
    selectNearbyGroupsError(state)
  );

  return {
    groups,
    distances,
    isLoading,
    error,
  };
}
