"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "ui/popover";
import { Button } from "ui/button";
import { Paperclip } from "lucide-react";

interface FileModePickerProps {
  file: File;
  onSelect: (mode: "text" | "binary") => void;
  onClose: () => void;
}

function truncateFileName(name: string): string {
  const maxStart = 10;
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex <= maxStart) {
    if (name.length <= maxStart) return name;
    return name.slice(0, maxStart) + "...";
  }
  const start = name.slice(0, maxStart);
  const ext = name.slice(dotIndex);
  return `${start}...${ext}`;
}

export function FileModePicker({
  file,
  onSelect,
  onClose,
}: FileModePickerProps) {
  const [open, setOpen] = useState(true);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) onClose();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className="cursor-pointer text-muted-foreground border rounded-full p-2 bg-transparent hover:bg-muted transition-all duration-200">
          <Paperclip className="size-4" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="p-4 w-56 rounded-lg shadow-md"
      >
        <div className="mb-3 font-semibold text-center" title={file.name}>
          How to upload &quot;{truncateFileName(file.name)}&quot;?
        </div>
        <Button
          className="w-full mb-2"
          onClick={() => {
            onSelect("text");
            onClose();
            setOpen(false);
          }}
        >
          Interpret as text
        </Button>
        <Button
          variant="secondary"
          className="w-full mb-2"
          onClick={() => {
            onSelect("binary");
            onClose();
            setOpen(false);
          }}
        >
          Upload as binary
        </Button>
      </PopoverContent>
    </Popover>
  );
}
