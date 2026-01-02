import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../../services/api";

export interface FileViewerProps {
  filePath: string | null;
}

interface FileState {
  content: string;
  path: string;
}

const getLanguageFromExtension = (filePath: string): string => {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    css: "css",
    html: "html",
    xml: "xml",
    sh: "shell",
    bash: "shell",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
  };
  return languageMap[ext || ""] || "plaintext";
};

export const FileViewer: React.FC<FileViewerProps> = ({ filePath }) => {
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setFileState(null);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.files.get(filePath);
        setFileState(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
        setFileState(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [filePath]);

  const handleCopy = async () => {
    if (!fileState?.content) return;

    try {
      await navigator.clipboard.writeText(fileState.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (!filePath) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">File Viewer</h4>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm">No file selected</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">{filePath}</h4>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            <p className="mt-2 text-sm text-gray-500">Loading file...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">{filePath}</h4>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center text-red-600">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 text-sm font-medium">Error loading file</p>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!fileState) {
    return null;
  }

  const language = getLanguageFromExtension(fileState.path);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">{fileState.path}</h4>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Checkmark icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Copy icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50">
        <pre
          className="h-full p-4 text-sm overflow-auto"
          style={{
            fontFamily: "Monaco, Menlo, Consolas, monospace",
            fontSize: "13px",
            lineHeight: "1.5",
            margin: 0,
          }}
        >
          <code className={`language-${language}`} style={{ display: "block" }}>
            {fileState.content}
          </code>
        </pre>
      </div>
    </div>
  );
};
