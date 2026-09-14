import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { autoEmbedImageUrls } from "@/lib/markdown";

export default function WeekIntro({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm p-5 mb-6">
      <div className="prose prose-neutral dark:prose-invert prose-img:rounded-xl prose-img:max-h-80 max-w-none prose-p:text-foreground prose-headings:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {autoEmbedImageUrls(markdown)}
        </ReactMarkdown>
      </div>
    </div>
  );
}
