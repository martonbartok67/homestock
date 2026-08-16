import { NextResponse } from "next/server";
import { importRecipeFromUrl } from "../../../../lib/server/recipe-importer";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Recipe import failed.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    const recipe = await importRecipeFromUrl(String(body.url ?? ""));
    return NextResponse.json({ recipe });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
