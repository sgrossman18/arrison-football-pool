// Lets the admin just paste a bare image/GIF URL on its own line in the
// weekly intro, instead of needing to know markdown image syntax.
const BARE_IMAGE_LINE =
  /^(https?:\/\/\S+\.(?:gif|jpe?g|png|webp)(?:\?\S*)?|https?:\/\/(?:media\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\/\S+)$/i;

export function autoEmbedImageUrls(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (BARE_IMAGE_LINE.test(trimmed)) {
        return `![](${trimmed})`;
      }
      return line;
    })
    .join("\n");
}
