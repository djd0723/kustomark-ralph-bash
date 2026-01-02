import type React from "react";
import { useEffect, useState } from "react";
import { OnNoMatchStrategy, type PatchOperation } from "../../types/config";

export interface PatchFormProps {
  patch: PatchOperation | null;
  onChange: (patch: PatchOperation) => void;
}

const OPERATION_TYPES = [
  { value: "replace", label: "Replace - Simple string replacement" },
  { value: "replace-regex", label: "Replace Regex - Regex-based replacement" },
  { value: "remove-section", label: "Remove Section - Remove markdown section" },
  { value: "replace-section", label: "Replace Section - Replace section content" },
  { value: "prepend-to-section", label: "Prepend to Section - Add content at start" },
  { value: "append-to-section", label: "Append to Section - Add content at end" },
  { value: "set-frontmatter", label: "Set Frontmatter - Set a frontmatter field" },
  { value: "remove-frontmatter", label: "Remove Frontmatter - Remove a field" },
  { value: "rename-frontmatter", label: "Rename Frontmatter - Rename a field" },
  { value: "merge-frontmatter", label: "Merge Frontmatter - Merge multiple fields" },
  { value: "delete-between", label: "Delete Between - Delete between markers" },
  { value: "replace-between", label: "Replace Between - Replace between markers" },
  { value: "replace-line", label: "Replace Line - Replace entire lines" },
  { value: "insert-after-line", label: "Insert After Line - Insert after match" },
  { value: "insert-before-line", label: "Insert Before Line - Insert before match" },
  { value: "move-section", label: "Move Section - Move section to new location" },
  { value: "rename-header", label: "Rename Header - Rename section header" },
  { value: "change-section-level", label: "Change Section Level - Change heading level" },
] as const;

export const PatchForm: React.FC<PatchFormProps> = ({ patch, onChange }) => {
  const [formData, setFormData] = useState<Partial<PatchOperation>>({});

  useEffect(() => {
    if (patch) {
      setFormData(patch);
    } else {
      setFormData({});
    }
  }, [patch]);

  if (!patch) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No patch selected</p>
          <p className="text-sm">Select a patch from the list or add a new one</p>
        </div>
      </div>
    );
  }

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange(updated as PatchOperation);
  };

  const handleArrayChange = (field: string, value: string) => {
    const values = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    handleFieldChange(field, values.length > 0 ? values : undefined);
  };

  const renderCommonFields = () => (
    <>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Patch ID (optional)</label>
        <input
          type="text"
          value={(formData as any).id || ""}
          onChange={(e) => handleFieldChange("id", e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="unique-patch-id"
        />
        <p className="text-xs text-gray-500 mt-1">Unique identifier for patch inheritance</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Extends (optional)</label>
        <input
          type="text"
          value={
            (formData as any).extends
              ? Array.isArray((formData as any).extends)
                ? (formData as any).extends.join(", ")
                : (formData as any).extends
              : ""
          }
          onChange={(e) => {
            const value = e.target.value.trim();
            if (value.includes(",")) {
              handleArrayChange("extends", value);
            } else {
              handleFieldChange("extends", value || undefined);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="patch-id-1, patch-id-2"
        />
        <p className="text-xs text-gray-500 mt-1">Patch ID(s) to inherit from (comma-separated)</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Include Pattern (optional)
        </label>
        <input
          type="text"
          value={
            (formData as any).include
              ? Array.isArray((formData as any).include)
                ? (formData as any).include.join(", ")
                : (formData as any).include
              : ""
          }
          onChange={(e) => {
            const value = e.target.value.trim();
            if (value.includes(",")) {
              handleArrayChange("include", value);
            } else {
              handleFieldChange("include", value || undefined);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="**/*.md, docs/**"
        />
        <p className="text-xs text-gray-500 mt-1">Glob patterns to include specific files</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Exclude Pattern (optional)
        </label>
        <input
          type="text"
          value={
            (formData as any).exclude
              ? Array.isArray((formData as any).exclude)
                ? (formData as any).exclude.join(", ")
                : (formData as any).exclude
              : ""
          }
          onChange={(e) => {
            const value = e.target.value.trim();
            if (value.includes(",")) {
              handleArrayChange("exclude", value);
            } else {
              handleFieldChange("exclude", value || undefined);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="README.md, test/**"
        />
        <p className="text-xs text-gray-500 mt-1">Glob patterns to exclude specific files</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          On No Match (optional)
        </label>
        <select
          value={(formData as any).onNoMatch || ""}
          onChange={(e) => handleFieldChange("onNoMatch", e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Default</option>
          <option value="skip">Skip</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">Behavior when patch doesn't match</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Group (optional)</label>
        <input
          type="text"
          value={(formData as any).group || ""}
          onChange={(e) => handleFieldChange("group", e.target.value || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="feature-flags"
        />
        <p className="text-xs text-gray-500 mt-1">Group name for selective patch application</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Validation - Not Contains (optional)
        </label>
        <input
          type="text"
          value={(formData as any).validate?.notContains || ""}
          onChange={(e) => {
            const value = e.target.value || undefined;
            handleFieldChange("validate", value ? { notContains: value } : undefined);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="forbidden-string"
        />
        <p className="text-xs text-gray-500 mt-1">Validate result doesn't contain this string</p>
      </div>
    </>
  );

  const renderOperationFields = () => {
    switch (formData.op) {
      case "replace":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Old String <span className="text-red-500">*</span>
              </label>
              <textarea
                value={(formData as any).old || ""}
                onChange={(e) => handleFieldChange("old", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                placeholder="Text to find and replace"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New String <span className="text-red-500">*</span>
              </label>
              <textarea
                value={(formData as any).new || ""}
                onChange={(e) => handleFieldChange("new", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                placeholder="Replacement text"
              />
            </div>
          </>
        );

      case "replace-regex":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).pattern || ""}
                onChange={(e) => handleFieldChange("pattern", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="(\d{4})-(\d{2})-(\d{2})"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Replacement <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).replacement || ""}
                onChange={(e) => handleFieldChange("replacement", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="$2/$3/$1"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flags (optional)
              </label>
              <input
                type="text"
                value={(formData as any).flags || ""}
                onChange={(e) => handleFieldChange("flags", e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="gi"
              />
              <p className="text-xs text-gray-500 mt-1">
                g=global, i=case-insensitive, m=multiline, s=dotall
              </p>
            </div>
          </>
        );

      case "remove-section":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).id || ""}
                onChange={(e) => handleFieldChange("id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="getting-started"
              />
              <p className="text-xs text-gray-500 mt-1">
                GitHub-style slug or explicit {"{#custom-id}"}
              </p>
            </div>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(formData as any).includeChildren !== false}
                  onChange={(e) => handleFieldChange("includeChildren", e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Include child sections</span>
              </label>
            </div>
          </>
        );

      case "replace-section":
      case "prepend-to-section":
      case "append-to-section":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).id || ""}
                onChange={(e) => handleFieldChange("id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="getting-started"
              />
              <p className="text-xs text-gray-500 mt-1">
                GitHub-style slug or explicit {"{#custom-id}"}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={(formData as any).content || ""}
                onChange={(e) => handleFieldChange("content", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={8}
                placeholder="Markdown content..."
              />
            </div>
          </>
        );

      case "set-frontmatter":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).key || ""}
                onChange={(e) => handleFieldChange("key", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="title"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value <span className="text-red-500">*</span>
              </label>
              <textarea
                value={
                  typeof (formData as any).value === "string"
                    ? (formData as any).value
                    : JSON.stringify((formData as any).value, null, 2) || ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  try {
                    const parsed = JSON.parse(value);
                    handleFieldChange("value", parsed);
                  } catch {
                    handleFieldChange("value", value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={4}
                placeholder="String or JSON value"
              />
              <p className="text-xs text-gray-500 mt-1">String value or JSON for arrays/objects</p>
            </div>
          </>
        );

      case "remove-frontmatter":
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(formData as any).key || ""}
              onChange={(e) => handleFieldChange("key", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="draft"
            />
          </div>
        );

      case "rename-frontmatter":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Old Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).old || ""}
                onChange={(e) => handleFieldChange("old", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="author"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).new || ""}
                onChange={(e) => handleFieldChange("new", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="authors"
              />
            </div>
          </>
        );

      case "merge-frontmatter":
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Values (JSON) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={JSON.stringify((formData as any).values, null, 2) || "{}"}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange("values", parsed);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={8}
              placeholder='{\n  "title": "New Title",\n  "tags": ["tag1", "tag2"]\n}'
            />
            <p className="text-xs text-gray-500 mt-1">JSON object of key-value pairs to merge</p>
          </div>
        );

      case "delete-between":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Marker <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).start || ""}
                onChange={(e) => handleFieldChange("start", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="<!-- START -->"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Marker <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).end || ""}
                onChange={(e) => handleFieldChange("end", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="<!-- END -->"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(formData as any).inclusive !== false}
                  onChange={(e) => handleFieldChange("inclusive", e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Include marker lines</span>
              </label>
            </div>
          </>
        );

      case "replace-between":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Marker <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).start || ""}
                onChange={(e) => handleFieldChange("start", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="<!-- START -->"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Marker <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).end || ""}
                onChange={(e) => handleFieldChange("end", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="<!-- END -->"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={(formData as any).content || ""}
                onChange={(e) => handleFieldChange("content", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={6}
                placeholder="Replacement content..."
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(formData as any).inclusive !== false}
                  onChange={(e) => handleFieldChange("inclusive", e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Include marker lines</span>
              </label>
            </div>
          </>
        );

      case "replace-line":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match (exact line) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).match || ""}
                onChange={(e) => handleFieldChange("match", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Old line content"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Replacement <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).replacement || ""}
                onChange={(e) => handleFieldChange("replacement", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="New line content"
              />
            </div>
          </>
        );

      case "insert-after-line":
      case "insert-before-line":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match (exact string)
              </label>
              <input
                type="text"
                value={(formData as any).match || ""}
                onChange={(e) => {
                  handleFieldChange("match", e.target.value || undefined);
                  if (e.target.value) {
                    handleFieldChange("pattern", undefined);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Exact line to match"
              />
              <p className="text-xs text-gray-500 mt-1">Mutually exclusive with pattern</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern (regex)
              </label>
              <input
                type="text"
                value={(formData as any).pattern || ""}
                onChange={(e) => {
                  handleFieldChange("pattern", e.target.value || undefined);
                  if (e.target.value) {
                    handleFieldChange("match", undefined);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="^\s*#\s+(.+)"
              />
              <p className="text-xs text-gray-500 mt-1">Mutually exclusive with match</p>
            </div>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(formData as any).regex === true}
                  onChange={(e) => handleFieldChange("regex", e.target.checked || undefined)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Pattern is regex</span>
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={(formData as any).content || ""}
                onChange={(e) => handleFieldChange("content", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={4}
                placeholder="Content to insert..."
              />
            </div>
          </>
        );

      case "move-section":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).id || ""}
                onChange={(e) => handleFieldChange("id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="section-to-move"
              />
              <p className="text-xs text-gray-500 mt-1">Section to move</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                After <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).after || ""}
                onChange={(e) => handleFieldChange("after", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="target-section"
              />
              <p className="text-xs text-gray-500 mt-1">Move after this section</p>
            </div>
          </>
        );

      case "rename-header":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).id || ""}
                onChange={(e) => handleFieldChange("id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="old-header-id"
              />
              <p className="text-xs text-gray-500 mt-1">Section to rename</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Header Text <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).new || ""}
                onChange={(e) => handleFieldChange("new", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="New Header Text"
              />
            </div>
          </>
        );

      case "change-section-level":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(formData as any).id || ""}
                onChange={(e) => handleFieldChange("id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="section-id"
              />
              <p className="text-xs text-gray-500 mt-1">Section to modify</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delta <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={(formData as any).delta || 0}
                onChange={(e) => handleFieldChange("delta", Number.parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                -1 to promote (### → ##), +1 to demote (## → ###)
              </p>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-white">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Edit Patch</h3>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Operation Type <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.op || "replace"}
          onChange={(e) => {
            const op = e.target.value;
            // Reset to minimal patch with new op
            const newPatch: any = { op };

            // Set defaults based on operation type
            switch (op) {
              case "replace":
                newPatch.old = "";
                newPatch.new = "";
                break;
              case "replace-regex":
                newPatch.pattern = "";
                newPatch.replacement = "";
                break;
              case "remove-section":
                newPatch.id = "";
                newPatch.includeChildren = true;
                break;
              case "replace-section":
              case "prepend-to-section":
              case "append-to-section":
                newPatch.id = "";
                newPatch.content = "";
                break;
              case "set-frontmatter":
                newPatch.key = "";
                newPatch.value = "";
                break;
              case "remove-frontmatter":
                newPatch.key = "";
                break;
              case "rename-frontmatter":
                newPatch.old = "";
                newPatch.new = "";
                break;
              case "merge-frontmatter":
                newPatch.values = {};
                break;
              case "delete-between":
                newPatch.start = "";
                newPatch.end = "";
                newPatch.inclusive = true;
                break;
              case "replace-between":
                newPatch.start = "";
                newPatch.end = "";
                newPatch.content = "";
                newPatch.inclusive = true;
                break;
              case "replace-line":
                newPatch.match = "";
                newPatch.replacement = "";
                break;
              case "insert-after-line":
              case "insert-before-line":
                newPatch.content = "";
                break;
              case "move-section":
                newPatch.id = "";
                newPatch.after = "";
                break;
              case "rename-header":
                newPatch.id = "";
                newPatch.new = "";
                break;
              case "change-section-level":
                newPatch.id = "";
                newPatch.delta = 0;
                break;
            }

            setFormData(newPatch);
            onChange(newPatch as PatchOperation);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {OPERATION_TYPES.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-gray-200 pt-6 mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Operation-Specific Fields</h4>
        {renderOperationFields()}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Common Fields</h4>
        {renderCommonFields()}
      </div>
    </div>
  );
};
