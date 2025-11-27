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
import { t } from '../lib/i18n';

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
            <CardTitle>{t("common.success")}</CardTitle>
            <CardDescription>
              {t("page.createGroup.groupCreated", { name: createdGroup.name }) || `Nhóm "${createdGroup.name}" đã được tạo.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("page.createGroup.canStartChatting") || "Bạn có thể bắt đầu trò chuyện với các thành viên cộng đồng gần đây."}
              </p>
              <Button onClick={handleBack}>{t("button.back")}</Button>
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
          {t("button.back")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("page.createGroup.title")}</CardTitle>
          <CardDescription>
            {t("page.createGroup.description")}
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

