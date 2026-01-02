import type React from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

export interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  title?: string;
  splitView?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldValue,
  newValue,
  title = "Diff",
  splitView = true,
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          compareMethod={DiffMethod.WORDS}
          styles={{
            variables: {
              light: {
                diffViewerBackground: "#fff",
                diffViewerColor: "#212529",
                addedBackground: "#e6ffed",
                addedColor: "#24292e",
                removedBackground: "#ffeef0",
                removedColor: "#24292e",
                wordAddedBackground: "#acf2bd",
                wordRemovedBackground: "#fdb8c0",
                addedGutterBackground: "#cdffd8",
                removedGutterBackground: "#ffdce0",
                gutterBackground: "#f7f7f7",
                gutterBackgroundDark: "#f3f1f1",
                highlightBackground: "#fffbdd",
                highlightGutterBackground: "#fff5b1",
              },
            },
            line: {
              padding: "10px 2px",
              fontSize: "13px",
              fontFamily: "Monaco, Menlo, Consolas, monospace",
            },
          }}
          useDarkTheme={false}
        />
      </div>
    </div>
  );
};
