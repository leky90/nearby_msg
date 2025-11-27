/**
 * Nearby Groups Page
 * Displays list of nearby groups with distance and activity
 */

import { useState, useEffect } from 'react';
import type { Group, RadiusOption } from '../domain/group';
import { discoverNearbyGroups } from '../services/group-service';
import { getCurrentLocation, isGeolocationAvailable } from '../services/location-service';
import { GroupCard } from '../components/groups/GroupCard';
import { RadiusFilter } from '../components/groups/RadiusFilter';
import { OfflineIndicator } from '../components/common/OfflineIndicator';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardContent } from '../components/ui/card';

export function NearbyGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [distances, setDistances] = useState<number[]>([]);
  const [radius, setRadius] = useState<RadiusOption>(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get user location on mount
  useEffect(() => {
    async function loadLocation() {
      if (isGeolocationAvailable()) {
        const loc = await getCurrentLocation();
        if (loc) {
          setLocation({ latitude: loc.latitude, longitude: loc.longitude });
        } else {
          setError('Unable to get location. Please enable location services.');
        }
      } else {
        setError('Geolocation not available. Please enter location manually.');
      }
    }
    loadLocation();
  }, []);

  // Load nearby groups when location or radius changes
  useEffect(() => {
    if (!location) return;

    async function loadGroups() {
      try {
        setLoading(true);
        setError(null);
        const response = await discoverNearbyGroups({
          latitude: location!.latitude,
          longitude: location!.longitude,
          radius,
        });
        setGroups(response.groups);
        setDistances(response.distances || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load nearby groups');
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, [location, radius]);

  const handleGroupClick = (group: Group) => {
    // TODO: Navigate to chat page
    console.log('Navigate to group:', group.id);
  };

  return (
    <div className="nearby-groups-page">
      <header className="nearby-groups-header">
        <h1 className="nearby-groups-title">Nearby Groups</h1>
        <OfflineIndicator />
      </header>

      <div className="nearby-groups-controls">
        <RadiusFilter radius={radius} onRadiusChange={setRadius} />
      </div>

      {error && (
        <div className="nearby-groups-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 p-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="nearby-groups-empty">
          <p>No groups found within {radius}m radius.</p>
          <p>Try increasing the search radius or create a new group.</p>
        </div>
      ) : (
        <div className="nearby-groups-list">
          {groups.map((group, index) => (
            <GroupCard
              key={group.id}
              group={group}
              distance={distances[index]}
              onClick={handleGroupClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

