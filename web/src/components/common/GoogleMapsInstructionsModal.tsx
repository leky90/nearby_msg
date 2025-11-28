/**
 * Google Maps Instructions Modal Component
 * Modal dialog displaying instructions on how to get Google Maps link
 */

import { Link, X } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface GoogleMapsInstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleMapsInstructionsModal({
  open,
  onOpenChange,
}: GoogleMapsInstructionsModalProps) {
  if (!open) return null;

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange} isDismissable>
      <Dialog className="w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Hướng dẫn lấy link Google Maps có tọa độ</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Làm theo các bước sau để lấy link Google Maps chứa tọa độ (lat,lng)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Google Maps Link */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Link className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex-1 min-w-0 truncate"
            >
              https://www.google.com/maps
            </a>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-foreground mb-2">
                Trên máy tính:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 ml-2 text-muted-foreground">
                <li>Mở Google Maps trên trình duyệt</li>
                <li>Tìm vị trí của bạn trên bản đồ</li>
                <li>
                  <strong>Zoom tối đa</strong> (phóng to hết cỡ) để lấy tọa độ
                  chính xác nhất
                </li>
                <li>
                  Nhấn chuột phải vào vị trí và chọn tọa độ (hoặc click vào vị
                  trí)
                </li>
                <li>
                  Copy URL từ thanh địa chỉ trình duyệt (URL sẽ có dạng:
                  maps.google.com/?q=lat,lng hoặc maps.google.com/@lat,lng)
                </li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-2">
                Trên điện thoại:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 ml-2 text-muted-foreground">
                <li>Mở ứng dụng Google Maps</li>
                <li>Tìm vị trí của bạn trên bản đồ</li>
                <li>
                  <strong>Zoom tối đa</strong> (phóng to hết cỡ) để lấy tọa độ
                  chính xác nhất
                </li>
                <li>Nhấn và giữ vào vị trí để đánh dấu</li>
                <li>Chọn tên địa điểm hoặc tọa độ hiển thị ở dưới</li>
                <li>
                  Chọn "Copy link" (không chọn "Chia sẻ" vì sẽ tạo short link
                  không có tọa độ)
                </li>
                <li>
                  Hoặc mở Google Maps trên trình duyệt và copy URL từ thanh địa
                  chỉ
                </li>
              </ol>
            </div>

            <div className="pt-3 border-t">
              <p className="font-semibold text-foreground mb-1">Lưu ý:</p>
              <p className="text-muted-foreground">
                Link phải chứa tọa độ (lat,lng) trong URL. Nếu link quá ngắn
                (goo.gl, maps.app.goo.gl), hãy mở link đó trên trình duyệt và
                copy URL đầy đủ từ thanh địa chỉ.
              </p>
            </div>
          </div>
        </div>
      </Dialog>
    </Modal>
  );
}
