/**
 * HistoryView — displays kustomark build history
 */

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";
import type { HistoryEntry, HistoryListResult, HistoryStatsResult } from "../../types/config";

interface HistoryViewProps {
  configPath: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface BuildRowProps {
  entry: HistoryEntry;
  configPath: string;
  onRollback: (id: string) => void;
  rolling: string | null;
}

function BuildRow({
  entry,
  configPath: _configPath,
  onRollback,
  rolling,
}: BuildRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* Summary row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Status badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            entry.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {entry.success ? "success" : "failed"}
        </span>

        {/* Build ID (short) */}
        <span className="font-mono text-xs text-gray-500 w-16 truncate" title={entry.id}>
          {entry.id.slice(0, 8)}
        </span>

        {/* Timestamp */}
        <span className="text-sm text-gray-700 flex-1">{formatDate(entry.timestamp)}</span>

        {/* Stats */}
        <span className="text-xs text-gray-500">{entry.fileCount} files</span>
        <span className="text-xs text-gray-500">{entry.totalPatchesApplied} patches</span>
        <span className="text-xs text-gray-500">{formatDuration(entry.duration)}</span>

        {/* Expand indicator */}
        <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-500">Build ID: </span>
                <span className="font-mono text-xs text-gray-700">{entry.id}</span>
              </div>
              <div>
                <span className="text-gray-500">Version: </span>
                <span className="text-gray-700">{entry.version}</span>
              </div>
              {entry.tags && entry.tags.length > 0 && (
                <div>
                  <span className="text-gray-500">Tags: </span>
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block bg-blue-100 text-blue-700 text-xs rounded px-1.5 py-0.5 mr-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {entry.description && (
                <div>
                  <span className="text-gray-500">Description: </span>
                  <span className="text-gray-700">{entry.description}</span>
                </div>
              )}
              {entry.files.length > 0 && (
                <div className="mt-2">
                  <p className="text-gray-500 mb-1">Files:</p>
                  <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                    {entry.files.map((f) => (
                      <li key={f.path} className="font-mono text-xs text-gray-600 flex gap-2">
                        <span className="truncate">{f.path}</span>
                        <span className="text-gray-400 shrink-0">
                          {formatBytes(f.outputSize)} · {f.patchesApplied}p
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Rollback button */}
            {entry.success && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRollback(entry.id);
                }}
                disabled={rolling !== null}
                className="shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-50 border border-amber-300 text-amber-700 rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rolling === entry.id ? "Rolling back…" : "Rollback"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryView({ configPath }: HistoryViewProps): React.ReactElement {
  const [data, setData] = useState<HistoryListResult | null>(null);
  const [stats, setStats] = useState<HistoryStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statsResult] = await Promise.all([
        api.history.list({ configPath }),
        api.history.stats(configPath),
      ]);
      setData(list);
      setStats(statsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [configPath]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRollback = async (buildId: string) => {
    setRolling(buildId);
    setRollbackMsg(null);
    try {
      const result = await api.history.rollback({ id: buildId, configPath, dryRun: false });
      setRollbackMsg(
        result.success
          ? `Rolled back to build ${buildId.slice(0, 8)}: ${result.filesRestored.length} files restored.`
          : "Rollback failed.",
      );
    } catch (err) {
      setRollbackMsg(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setRolling(null);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Build History</h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Stats bar */}
      {stats && stats.totalBuilds > 0 && (
        <div className="px-4 py-2 bg-white border-b border-gray-100 flex gap-4 text-xs text-gray-600">
          <span>{stats.totalBuilds} total</span>
          <span className="text-green-600">{stats.successfulBuilds} succeeded</span>
          {stats.failedBuilds > 0 && (
            <span className="text-red-600">{stats.failedBuilds} failed</span>
          )}
          {stats.avgFileCount > 0 && <span>{stats.avgFileCount.toFixed(1)} avg files</span>}
        </div>
      )}

      {/* Rollback message */}
      {rollbackMsg && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          {rollbackMsg}
          <button
            type="button"
            className="ml-2 text-amber-600 hover:text-amber-800"
            onClick={() => setRollbackMsg(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && !data && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-500">Loading history…</p>
          </div>
        )}

        {!loading && (!data || data.builds.length === 0) && (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-sm text-gray-500">No build history found.</p>
            <p className="text-xs text-gray-400 mt-1">
              Run <code className="bg-gray-100 px-1 rounded">kustomark build</code> to create a
              build entry.
            </p>
          </div>
        )}

        {data && data.builds.length > 0 && (
          <div className="space-y-2">
            {data.builds.map((entry) => (
              <BuildRow
                key={entry.id}
                entry={entry}
                configPath={configPath}
                onRollback={handleRollback}
                rolling={rolling}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
