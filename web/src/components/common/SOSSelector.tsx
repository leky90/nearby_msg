/**
 * SOS Type Selector Modal
 * Modal for selecting SOS emergency type
 */

import { useState } from "react";
import { X, Heart, Waves, Flame, UserSearch } from "lucide-react";
import type { SOSType } from "../../domain/message";
import { Modal } from "../ui/modal";
import { Dialog, DialogHeader, DialogTitle } from "../ui/dialog";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { t } from "@/lib/i18n";

export interface SOSSelectorProps {
  /** Callback when SOS type is selected */
  onSelect: (sosType: SOSType) => void;
  /** Callback when modal is closed */
  onClose: () => void;
}

const getSOSTypes = (): Array<{
  type: SOSType;
  label: string;
  icon: React.ReactNode;
  description: string;
}> => [
  {
    type: "medical",
    label: t("sos.medical"),
    icon: <Heart className="size-5" />,
    description: t("sos.description.medical"),
  },
  {
    type: "flood",
    label: t("sos.flood"),
    icon: <Waves className="size-5" />,
    description: t("sos.description.flood"),
  },
  {
    type: "fire",
    label: t("sos.fire"),
    icon: <Flame className="size-5" />,
    description: t("sos.description.fire"),
  },
  {
    type: "missing_person",
    label: t("sos.missingPerson"),
    icon: <UserSearch className="size-5" />,
    description: t("sos.description.missingPerson"),
  },
];

/**
 * SOS Type Selector component
 * Displays a modal with SOS type options using shadcn Dialog and RadioGroup
 */
export function SOSSelector({ onSelect, onClose }: SOSSelectorProps) {
  const [selectedType, setSelectedType] = useState<SOSType | "">("");
  const SOS_TYPES = getSOSTypes();

  const handleSelect = (value: string) => {
    setSelectedType(value as SOSType);
  };

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType);
    }
  };

  return (
    <Modal isOpen isDismissable onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog className="w-full max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-heading-2 leading-heading-2">
              {t("component.sosSelector.title")}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedType} onValueChange={handleSelect}>
            <div className="space-y-3">
              {SOS_TYPES.map((sos) => (
                <div key={sos.type} className="flex items-start space-x-3">
                  <RadioGroupItem
                    value={sos.type}
                    id={sos.type}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={sos.type}
                    className="flex-1 cursor-pointer space-y-1 rounded-lg border p-3 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{sos.icon}</span>
                      <span className="font-medium text-body leading-body">
                        {sos.label}
                      </span>
                    </div>
                    <p className="text-body leading-body text-muted-foreground">
                      {sos.description}
                    </p>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="h-12">
            {t("button.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isDisabled={!selectedType}
            className="h-12"
          >
            {t("button.sendSOS")}
          </Button>
        </div>
      </Dialog>
    </Modal>
  );
}
