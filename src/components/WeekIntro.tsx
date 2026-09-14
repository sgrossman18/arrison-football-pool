import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { autoEmbedImageUrls } from "@/lib/markdown";

export default function WeekIntro({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;

  return (
    <div className="prose prose-neutral dark:prose-invert prose-img:rounded-lg prose-img:max-h-80 max-w-none mb-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {autoEmbedImageUrls(markdown)}
      </ReactMarkdown>
    </div>
  );
}
