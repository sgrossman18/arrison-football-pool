import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

// Weekly-intro image uploads go browser -> this route -> Vercel Blob, rather
// than the browser uploading straight to Blob storage. We tried the
// straight-to-Blob client SDK first; in production it silently hung for
// upwards of a minute with no visible error (its request goes through
// vercel.com/api/blob and gets retried several times by the SDK's own
// async-retry wrapper before giving up, with no progress surfaced to the
// UI). Routing through our own server instead is a single plain
// authenticated request/response — much easier to reason about, and behaves
// identically in local dev and production since there's no browser-side
// cross-origin request involved at all. The tradeoff is Vercel's ~4.5MB
// request body limit for serverless functions, hence the 4MB cap below
// (vs. 8MB when this went straight to Blob).
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "That's not an image file (jpg, png, gif, and webp only)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That image is too big — ${Math.round(file.size / 1024 / 1024)}MB, 4MB max.` },
      { status: 400 },
    );
  }

  try {
    const blob = await put(file.name, file, { access: "public", addRandomSuffix: true });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
