import type React from "react";
import { useEffect, useState } from "react";
import * as YAML from "yaml";
import { Button } from "./components/common/Button";
import { PatchEditor } from "./components/editor/PatchEditor";
import FileBrowser from "./components/editor/FileBrowser";
import { DiffViewer } from "./components/preview/DiffViewer";
import { MarkdownPreview } from "./components/preview/MarkdownPreview";
import FileViewer from "./components/preview/FileViewer";
import { api } from "./services/api";
import type {
  BuildResult,
  KustomarkConfig,
  PatchOperation,
  ValidationResult,
} from "./types/config";

type ViewMode = "editor" | "diff" | "preview" | "files";

export const App: React.FC = () => {
  const [configPath] = useState("kustomark.yaml");
  const [config, setConfig] = useState<KustomarkConfig | null>(null);
  const [patches, setPatches] = useState<PatchOperation[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.config.get(configPath);
      const parsed = YAML.parse(response.content) as KustomarkConfig;
      setConfig(parsed);
      setPatches(parsed.patches || []);
      setOriginalContent(response.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
      // Initialize with default config
      const defaultConfig: KustomarkConfig = {
        apiVersion: "kustomark/v1",
        kind: "Kustomization",
        resources: [],
        patches: [],
      };
      setConfig(defaultConfig);
      setPatches([]);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setLoading(true);
      setError(null);

      const updatedConfig = { ...config, patches };
      const content = YAML.stringify(updatedConfig);

      // Validate before saving
      const validation = await api.config.validate({ content });
      setValidation(validation);

      if (!validation.valid) {
        setError("Config validation failed. Please fix errors before saving.");
        return;
      }

      await api.config.save(configPath, content);
      setOriginalContent(content);
      alert("Config saved successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = async () => {
    if (!config) return;

    try {
      setLoading(true);
      setError(null);

      const updatedConfig = { ...config, patches };
      const content = YAML.stringify(updatedConfig);
      const result = await api.config.validate({ content });
      setValidation(result);

      if (result.valid) {
        alert("Config is valid!");
      } else {
        setError(`Validation failed with ${result.errors.length} errors`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  const executeBuild = async () => {
    if (!config) return;

    try {
      setLoading(true);
      setError(null);
      setBuildResult(null);

      // Save config first
      const updatedConfig = { ...config, patches };
      const content = YAML.stringify(updatedConfig);
      await api.config.save(configPath, content);

      // Execute build
      const result = await api.build.execute({
        configPath,
        incremental: false,
      });

      setBuildResult(result);
      alert(
        `Build completed! ${result.filesWritten} files written, ${result.patchesApplied} patches applied in ${result.duration}ms`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentContent = () => {
    if (!config) return "";
    const updatedConfig = { ...config, patches };
    return YAML.stringify(updatedConfig);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kustomark Web UI</h1>
              <p className="text-sm text-gray-600 mt-1">
                Visual editor for Kustomark configurations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={validateConfig} disabled={loading}>
                Validate
              </Button>
              <Button variant="secondary" size="sm" onClick={saveConfig} disabled={loading}>
                Save Config
              </Button>
              <Button variant="primary" size="sm" onClick={executeBuild} disabled={loading}>
                Build
              </Button>
            </div>
          </div>

          {/* Status bar */}
          {(error || validation || buildResult) && (
            <div className="mt-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {validation && !validation.valid && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md px-4 py-3">
                  <p className="text-sm font-medium text-yellow-900 mb-2">
                    Validation Errors ({validation.errors.length})
                  </p>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {validation.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>
                        {err.field && <span className="font-medium">{err.field}: </span>}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                  {validation.errors.length > 5 && (
                    <p className="text-xs text-yellow-700 mt-2">
                      ... and {validation.errors.length - 5} more
                    </p>
                  )}
                </div>
              )}

              {validation?.valid && validation.warnings.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Warnings ({validation.warnings.length})
                  </p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {validation.warnings.slice(0, 3).map((warn, i) => (
                      <li key={i}>{warn.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {buildResult && (
                <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3">
                  <p className="text-sm text-green-800">
                    Build completed: {buildResult.filesWritten} files written,{" "}
                    {buildResult.patchesApplied} patches applied in {buildResult.duration}ms
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Patch editor */}
        <div className="w-1/2 border-r border-gray-200 bg-white flex flex-col">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Patches ({patches.length})</h2>
              <span className="text-xs text-gray-500">{configPath}</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <PatchEditor patches={patches} onPatchesChange={setPatches} />
          </div>
        </div>

        {/* Right panel - Preview/Diff */}
        <div className="w-1/2 bg-white flex flex-col">
          {/* View mode tabs */}
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("editor")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "editor"
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                YAML Editor
              </button>
              <button
                onClick={() => setViewMode("diff")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "diff"
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Diff View
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "preview"
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode("files")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "files"
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Files
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {viewMode === "editor" && (
              <div className="h-full p-4 overflow-y-auto">
                <textarea
                  value={getCurrentContent()}
                  readOnly
                  className="w-full h-full font-mono text-sm border border-gray-300 rounded-md p-3 bg-gray-50"
                  style={{ resize: "none" }}
                />
              </div>
            )}

            {viewMode === "diff" && (
              <DiffViewer
                oldValue={originalContent}
                newValue={getCurrentContent()}
                title="Config Changes"
                splitView={false}
              />
            )}

            {viewMode === "preview" && (
              <MarkdownPreview content={getCurrentContent()} title="Config Preview" />
            )}

            {viewMode === "files" && (
              <div className="h-full flex">
                {/* Left panel - File Browser (30%) */}
                <div className="w-[30%] border-r border-gray-200 overflow-hidden">
                  <FileBrowser onSelectFile={setSelectedFilePath} />
                </div>
                {/* Right panel - File Viewer (70%) */}
                <div className="w-[70%] overflow-hidden">
                  <FileViewer filePath={selectedFilePath} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div>
            {config && (
              <span>
                API: {config.apiVersion} | Kind: {config.kind} | Resources:{" "}
                {config.resources.length}
              </span>
            )}
          </div>
          <div>
            <a
              href="https://github.com/kustomark/kustomark"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-800"
            >
              Documentation
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
