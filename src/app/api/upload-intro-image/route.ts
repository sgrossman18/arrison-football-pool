import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";

// Issues short-lived client tokens for direct-to-Vercel-Blob uploads of
// weekly-intro images (see IntroEditor). Uploading straight from the
// browser to Blob storage, rather than routing the file through this
// serverless function, keeps big photos well clear of Vercel's request-body
// size limits. Not using requireAdmin() here since that redirects on
// failure, which doesn't make sense for a fetch-based API route — this
// throws instead, which handleUpload turns into an error response the
// client sees directly.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.isAdmin) {
          throw new Error("Admin sign-in required.");
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do — the client inserts the image into the intro
        // markdown itself once the upload resolves. (Vercel can't reach
        // this callback against a localhost dev server anyway; the upload
        // still succeeds either way.)
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
