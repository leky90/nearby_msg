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

export interface SOSSelectorProps {
  /** Callback when SOS type is selected */
  onSelect: (sosType: SOSType) => void;
  /** Callback when modal is closed */
  onClose: () => void;
}

const SOS_TYPES: Array<{
  type: SOSType;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    type: "medical",
    label: "Medical Emergency",
    icon: <Heart className="size-5" />,
    description: "Need immediate medical assistance",
  },
  {
    type: "flood",
    label: "Flood Emergency",
    icon: <Waves className="size-5" />,
    description: "Need evacuation assistance",
  },
  {
    type: "fire",
    label: "Fire Emergency",
    icon: <Flame className="size-5" />,
    description: "Need immediate fire assistance",
  },
  {
    type: "missing_person",
    label: "Missing Person",
    icon: <UserSearch className="size-5" />,
    description: "Need help locating someone",
  },
];

/**
 * SOS Type Selector component
 * Displays a modal with SOS type options using shadcn Dialog and RadioGroup
 */
export function SOSSelector({ onSelect, onClose }: SOSSelectorProps) {
  const [selectedType, setSelectedType] = useState<SOSType | "">("");

  const handleSelect = (value: string) => {
    setSelectedType(value as SOSType);
  };

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType);
    }
  };

  return (
    <Modal isOpen isDismissable onDismiss={onClose}>
      <Dialog className="w-full max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Select Emergency Type</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
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
                      <span className="font-medium">{sos.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {sos.description}
                    </p>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isDisabled={!selectedType}
          >
            Send SOS
          </Button>
        </div>
      </Dialog>
    </Modal>
  );
}
