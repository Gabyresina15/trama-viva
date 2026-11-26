import { NextRequest, NextResponse } from "next/server";
import { getPieceMediaBuffer } from "@/lib/store/pieces-store";


export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind = kindParam === "photo" ? "photo" : "audio";

  const media = await getPieceMediaBuffer(id, kind);
  if (!media) {
    return new NextResponse("Not found", { status: 404 });
  }

  const total = media.buffer.byteLength;
  const range = req.headers.get("range");

  // Soporte HTTP Range obligatorio para que Safari en iOS reproduzca <audio> sin fallos
  if (range && kind === "audio") {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (start < total && start <= end) {
        const chunk = media.buffer.subarray(start, end + 1);
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": media.mimeType,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunk.byteLength.toString(),
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }
  }

  return new NextResponse(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Accept-Ranges": "bytes",
      "Content-Length": total.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
