import clsx from "clsx";
import type React from "react";
import type { PatchOperation } from "../../types/config";
import { Button } from "../common/Button";

export interface PatchListProps {
  patches: PatchOperation[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

const getPatchLabel = (patch: PatchOperation, index: number): string => {
  const prefix = patch.id ? `[${patch.id}]` : `#${index + 1}`;
  return `${prefix} ${patch.op}`;
};

const getPatchDescription = (patch: PatchOperation): string => {
  switch (patch.op) {
    case "replace":
      return `"${patch.old.substring(0, 30)}..." → "${patch.new.substring(0, 30)}..."`;
    case "replace-regex":
      return `Pattern: ${patch.pattern}`;
    case "remove-section":
    case "replace-section":
    case "prepend-to-section":
    case "append-to-section":
    case "rename-header":
    case "change-section-level":
      return `Section: ${patch.id}`;
    case "set-frontmatter":
    case "remove-frontmatter":
      return `Key: ${patch.key}`;
    case "rename-frontmatter":
      return `${patch.old} → ${patch.new}`;
    case "delete-between":
    case "replace-between":
      return `Between: ${patch.start} ... ${patch.end}`;
    case "replace-line":
      return `Match: ${patch.match}`;
    case "insert-after-line":
    case "insert-before-line":
      return patch.match ? `Match: ${patch.match}` : `Pattern: ${patch.pattern}`;
    case "move-section":
      return `Move ${patch.id} after ${patch.after}`;
    case "merge-frontmatter":
      return `${Object.keys(patch.values).length} fields`;
    default:
      return "";
  }
};

export const PatchList: React.FC<PatchListProps> = ({
  patches,
  selectedIndex,
  onSelect,
  onAdd,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <Button variant="primary" size="sm" onClick={onAdd} className="w-full">
          Add Patch
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {patches.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No patches yet. Click "Add Patch" to create one.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {patches.map((patch, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: Patches array is stable, items added at end only
                key={index}
                className={clsx(
                  "p-4 cursor-pointer hover:bg-gray-50 transition-colors",
                  selectedIndex === index && "bg-primary-50 border-l-4 border-primary-600",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(index);
                    }
                  }}
                  className="w-full text-left"
                  style={{ padding: "0" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {getPatchLabel(patch, index)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {getPatchDescription(patch)}
                      </div>
                      {patch.group && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {patch.group}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="ml-2 flex flex-col space-y-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveUp(index);
                        }}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-label="Move up"
                        >
                          <title>Move up</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveDown(index);
                        }}
                        disabled={index === patches.length - 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-label="Move down"
                        >
                          <title>Move down</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this patch?")) {
                            onDelete(index);
                          }
                        }}
                        className="p-1 rounded hover:bg-red-100 text-red-600"
                        title="Delete"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-label="Delete"
                        >
                          <title>Delete</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
