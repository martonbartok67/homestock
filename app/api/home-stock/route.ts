import { NextResponse } from "next/server";
import {
  addInventoryItem,
  addRecipe,
  addShoppingItem,
  addShoppingItems,
  deleteInventoryItem,
  deleteShoppingItem,
  finishInventoryItem,
  getSnapshot,
  toggleShoppingItem,
} from "../../../lib/server/home-stock-repository";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error.";
}

export async function GET() {
  try {
    return NextResponse.json(await getSnapshot());
  } catch (error) {
    return NextResponse.json({ code: "DATABASE_NOT_CONFIGURED", error: errorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; id?: string; item?: Record<string, unknown>; items?: Array<Record<string, unknown>>; recipe?: Record<string, unknown> };
    let snapshot;
    switch (body.action) {
      case "addInventory": snapshot = await addInventoryItem(body.item as never); break;
      case "deleteInventory": snapshot = await deleteInventoryItem(String(body.id)); break;
      case "finishInventory": snapshot = await finishInventoryItem(String(body.id)); break;
      case "addShopping": snapshot = await addShoppingItem(body.item as never); break;
      case "addShoppingBatch": snapshot = await addShoppingItems((body.items ?? []) as never); break;
      case "addRecipe": snapshot = await addRecipe(body.recipe as never); break;
      case "toggleShopping": snapshot = await toggleShoppingItem(String(body.id)); break;
      case "deleteShopping": snapshot = await deleteShoppingItem(String(body.id)); break;
      default: return NextResponse.json({ error: "Unknown HomeStock action." }, { status: 400 });
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ code: "DATABASE_ERROR", error: errorMessage(error) }, { status: 503 });
  }
}
