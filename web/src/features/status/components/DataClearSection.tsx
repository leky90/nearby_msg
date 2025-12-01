/**
 * Data Clear Section
 * Allows user to clear all local data
 * Single Responsibility: Data clearing UI
 */

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useDispatch } from "react-redux";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { Heading, Text } from "react-aria-components";
import { clearDeviceAction } from "@/features/device/store/saga";
import { showToast } from "@/shared/utils/toast";

/**
 * DataClearSection component
 * Provides UI for clearing all user data
 */
export function DataClearSection() {
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClearData = () => {
    // Dispatch Redux action - saga handles clearing data
    dispatch(clearDeviceAction());
    showToast("Đã xóa tất cả dữ liệu. Vui lòng đăng ký lại.", "success");

    // Reload page to trigger onboarding
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="text-sm font-medium text-foreground">Xóa dữ liệu</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Xóa tất cả dữ liệu local bao gồm tin nhắn, nhóm, và cài đặt. Bạn sẽ cần
        đăng ký lại sau khi xóa.
      </p>

      <Button
        variant="destructive"
        className="w-full"
        onPress={() => setIsModalOpen(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Xóa tất cả dữ liệu
      </Button>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <div className="p-6 space-y-4 max-w-md">
            <Heading className="text-lg font-semibold">
              Xác nhận xóa dữ liệu
            </Heading>
            <Text className="text-sm text-muted-foreground space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa tất cả dữ liệu local không? Hành động
                này không thể hoàn tác.
              </p>
              <p className="font-medium mt-4">Dữ liệu sẽ bị xóa bao gồm:</p>
              <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                <li>Tất cả tin nhắn đã lưu</li>
                <li>Tất cả nhóm đã lưu</li>
                <li>Danh sách quan tâm</li>
                <li>Tin nhắn đã ghim</li>
                <li>Trạng thái người dùng</li>
                <li>Thông tin đăng nhập</li>
              </ul>
              <p className="mt-4 font-medium text-destructive">
                Bạn sẽ cần đăng ký lại sau khi xóa.
              </p>
            </Text>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onPress={() => setIsModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="destructive" onPress={handleClearData}>
                Xóa dữ liệu
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
