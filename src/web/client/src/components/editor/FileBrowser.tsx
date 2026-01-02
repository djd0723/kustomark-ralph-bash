import clsx from "clsx";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import type { FileNode } from "../../types/config";

export interface FileBrowserProps {
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  rootPath?: string;
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedPath,
  onSelectFile,
  expandedPaths,
  onToggleExpand,
}) => {
  const isDirectory = node.type === "directory";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = isDirectory && node.children && node.children.length > 0;

  const handleClick = () => {
    if (isDirectory) {
      onToggleExpand(node.path);
    } else {
      onSelectFile(node.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const itemCount = hasChildren && node.children ? node.children.length : 0;

  return (
    <div>
      <div
        className={clsx(
          "flex items-center py-1.5 px-3 cursor-pointer hover:bg-gray-100 transition-colors",
          isSelected && "bg-primary-50 border-l-4 border-primary-600",
          !isSelected && "pl-4",
        )}
        style={{ paddingLeft: `${level * 16 + (isSelected ? 12 : 16)}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        // biome-ignore lint/a11y/useSemanticElements: Using div for layout flexibility with keyboard events
        role="button"
        tabIndex={0}
      >
        {isDirectory && (
          <span className="mr-2 text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
        )}
        <span className="mr-2" role="img" aria-label={isDirectory ? "folder" : "file"}>
          {isDirectory ? "📁" : "📄"}
        </span>
        <span className="text-sm text-gray-900 flex-1 truncate">{node.name}</span>
        {isDirectory && hasChildren && (
          <span className="ml-2 text-xs text-gray-500">({itemCount})</span>
        )}
      </div>

      {isDirectory && isExpanded && hasChildren && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileBrowser: React.FC<FileBrowserProps> = ({
  onSelectFile,
  selectedPath,
  rootPath = ".",
}) => {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]));

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.files.tree(rootPath);
        setTree(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file tree");
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [rootPath]);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <p className="mt-2 text-sm text-gray-500">Loading files...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>Error loading files</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load files</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">No files found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-900">File Browser</h3>
        {rootPath !== "." && (
          <p className="mt-1 text-xs text-gray-500 truncate" title={rootPath}>
            {rootPath}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <TreeNode
          node={tree}
          level={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          expandedPaths={expandedPaths}
          onToggleExpand={handleToggleExpand}
        />
      </div>
    </div>
  );
};
