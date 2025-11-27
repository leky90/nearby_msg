/**
 * Create Group Page
 * Page for creating a new community group
 */

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Group } from '../domain/group';
import { CreateGroupForm } from '../components/groups/CreateGroupForm';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

export interface CreateGroupPageProps {
  /** Callback when group is created */
  onGroupCreated?: (group: Group) => void;
  /** Callback to go back */
  onBack?: () => void;
}

/**
 * Create Group Page component
 * Displays form for creating a new group
 */
export function CreateGroupPage({ onGroupCreated, onBack }: CreateGroupPageProps) {
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  const handleGroupCreated = (group: Group) => {
    setCreatedGroup(group);
    onGroupCreated?.(group);
  };

  const handleBack = () => {
    onBack?.();
  };

  if (createdGroup) {
    return (
      <div className="container mx-auto max-w-2xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Group Created Successfully!</CardTitle>
            <CardDescription>
              Your group &quot;{createdGroup.name}&quot; has been created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You can now start chatting with nearby community members.
              </p>
              <Button onClick={handleBack}>Go to Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a New Group</CardTitle>
          <CardDescription>
            Create a community group for your area. Each device can create one group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateGroupForm
            onGroupCreated={handleGroupCreated}
            onCancel={handleBack}
          />
        </CardContent>
      </Card>
    </div>
  );
}

