import type React from "react";
import { useState } from "react";
import type { PatchOperation } from "../../types/config";
import { PatchForm } from "./PatchForm";
import { PatchList } from "./PatchList";

export interface PatchEditorProps {
  patches: PatchOperation[];
  onPatchesChange: (patches: PatchOperation[]) => void;
}

export const PatchEditor: React.FC<PatchEditorProps> = ({ patches, onPatchesChange }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleAdd = () => {
    const newPatch: PatchOperation = {
      op: "replace",
      old: "",
      new: "",
    };
    const updatedPatches = [...patches, newPatch];
    onPatchesChange(updatedPatches);
    setSelectedIndex(updatedPatches.length - 1);
  };

  const handleUpdate = (patch: PatchOperation) => {
    if (selectedIndex === null) return;
    const updatedPatches = [...patches];
    updatedPatches[selectedIndex] = patch;
    onPatchesChange(updatedPatches);
  };

  const handleDelete = (index: number) => {
    const updatedPatches = patches.filter((_, i) => i !== index);
    onPatchesChange(updatedPatches);
    if (selectedIndex === index) {
      setSelectedIndex(null);
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updatedPatches = [...patches];
    [updatedPatches[index - 1], updatedPatches[index]] = [
      updatedPatches[index],
      updatedPatches[index - 1],
    ];
    onPatchesChange(updatedPatches);
    if (selectedIndex === index) {
      setSelectedIndex(index - 1);
    } else if (selectedIndex === index - 1) {
      setSelectedIndex(index);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index === patches.length - 1) return;
    const updatedPatches = [...patches];
    [updatedPatches[index], updatedPatches[index + 1]] = [
      updatedPatches[index + 1],
      updatedPatches[index],
    ];
    onPatchesChange(updatedPatches);
    if (selectedIndex === index) {
      setSelectedIndex(index + 1);
    } else if (selectedIndex === index + 1) {
      setSelectedIndex(index);
    }
  };

  return (
    <div className="h-full flex">
      {/* Left side - Patch list */}
      <div className="w-80 border-r border-gray-200 bg-gray-50">
        <PatchList
          patches={patches}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>

      {/* Right side - Patch form */}
      <div className="flex-1 overflow-y-auto bg-white">
        <PatchForm
          patch={selectedIndex !== null ? patches[selectedIndex] : null}
          onChange={handleUpdate}
        />
      </div>
    </div>
  );
};
