import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownPreviewProps {
  content: string;
  title?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, title = "Preview" }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <article className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
};
