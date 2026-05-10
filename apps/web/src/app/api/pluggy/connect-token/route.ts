import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPluggyClient } from "@/lib/pluggy";

export const runtime = "nodejs";

const Body = z.object({
  itemId: z.string().uuid().optional(),
});

/**
 * POST /api/pluggy/connect-token
 *
 * Cria um token de curta duração que o widget Pluggy Connect (client-side)
 * usa pra autenticar. Passe `itemId` pra atualizar item existente
 * (re-consent OFB) ou omita pra criar item novo.
 */
export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const client = getPluggyClient();
    const accessToken = await client.createConnectToken({
      clientUserId: userId,
      itemId: parsed.data.itemId,
    });
    return NextResponse.json({ accessToken });
  } catch (err) {
    return NextResponse.json(
      { error: "pluggy_error", message: String(err) },
      { status: 502 },
    );
  }
}
