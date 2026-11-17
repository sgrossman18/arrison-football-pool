// Lets the admin just paste a bare image/GIF link on its own line in the
// weekly intro, instead of needing to know markdown image syntax.

// A path that names an image file: ends in the extension, or has it before a
// query string, fragment or further path (e.g. Wix's ".jpg/v1/fill/...").
const IMAGE_PATH = /\.(?:gif|jpe?g|png|webp|avif)(?=$|[?#/&])/i;

// Hosts that only serve images/GIFs, whatever the path looks like.
const IMAGE_HOST =
  /^(?:(?:[\w-]+\.)?giphy\.com|(?:media[\w-]*|c|i)\.tenor\.com|i\.imgur\.com|pbs\.twimg\.com|[\w-]+\.public\.blob\.vercel-storage\.com)$/i;

// A Giphy *page* link ("Copy link" on giphy.com) isn't an image, but the GIF's
// id is the last chunk of its path and maps to a direct image URL.
const GIPHY_PAGE = /^\/(?:gifs|stickers|embed)\/(?:[\w-]*-)?([A-Za-z0-9]+)\/?$/;

function toImageUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  if (host === "giphy.com" || host === "www.giphy.com") {
    const m = GIPHY_PAGE.exec(url.pathname);
    return m ? `https://media.giphy.com/media/${m[1]}/giphy.gif` : null;
  }
  if (IMAGE_HOST.test(host) && url.pathname.length > 1) return raw;
  return IMAGE_PATH.test(url.pathname) ? raw : null;
}

export function autoEmbedImageUrls(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      // Pasted links often arrive wrapped in <>, or with stray zero-width
      // characters or non-breaking spaces around them.
      const cleaned = line
        .replace(/[​-‍﻿]/g, "")
        .replace(/ /g, " ")
        .trim()
        .replace(/^<(.*)>$/, "$1");
      if (/\s/.test(cleaned)) return line;
      const image = toImageUrl(cleaned);
      return image ? `![](${image})` : line;
    })
    .join("\n");
}
