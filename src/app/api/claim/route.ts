import { connection, NextResponse } from "next/server";
import {
  claimArtisanBridge,
  getArtisanPendingBalanceBridge,
} from "@/lib/bridge/chain";

export async function GET() {
  await connection();
  const status = await getArtisanPendingBalanceBridge();
  return NextResponse.json({ status });
}

export async function POST() {
  try {
    const claimResult = await claimArtisanBridge();
    return NextResponse.json({ claim: claimResult });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo reclamar el saldo acumulado del contrato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
