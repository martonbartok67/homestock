import { NextResponse } from "next/server";
import {
  addInventoryItem,
  addRecipe,
  addShoppingItem,
  addShoppingItems,
  deleteRecipe,
  deleteInventoryItem,
  deleteShoppingItem,
  finishInventoryItem,
  getSnapshot,
  toggleShoppingItem,
  updateRecipe,
} from "../../../lib/server/home-stock-repository";
import { parseHomeStockAction, RequestValidationError } from "../../../lib/server/home-stock-input";
import { householdAccessResponse, requireHousehold } from "../../../lib/server/household-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { householdId } = await requireHousehold();
    return NextResponse.json(await getSnapshot(householdId));
  } catch (error) {
    const accessResponse = householdAccessResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[home-stock] Could not load household data.", error);
    return NextResponse.json({ code: "DATABASE_UNAVAILABLE", error: "Household data is unavailable right now." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { householdId } = await requireHousehold();
    const body = parseHomeStockAction(await request.json().catch(() => {
      throw new RequestValidationError("Request body must be valid JSON.");
    }));
    let snapshot;
    switch (body.action) {
      case "addInventory": snapshot = await addInventoryItem(householdId, body.item); break;
      case "deleteInventory": snapshot = await deleteInventoryItem(householdId, body.id); break;
      case "finishInventory": snapshot = await finishInventoryItem(householdId, body.id); break;
      case "addShopping": snapshot = await addShoppingItem(householdId, body.item); break;
      case "addShoppingBatch": snapshot = await addShoppingItems(householdId, body.items); break;
      case "addRecipe": snapshot = await addRecipe(householdId, body.recipe); break;
      case "updateRecipe": snapshot = await updateRecipe(householdId, body.id, body.recipe); break;
      case "deleteRecipe": snapshot = await deleteRecipe(householdId, body.id); break;
      case "toggleShopping": snapshot = await toggleShoppingItem(householdId, body.id); break;
      case "deleteShopping": snapshot = await deleteShoppingItem(householdId, body.id); break;
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    const accessResponse = householdAccessResponse(error);
    if (accessResponse) return accessResponse;
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ code: "INVALID_REQUEST", error: error.message }, { status: 400 });
    }
    console.error("[home-stock] Could not save household change.", error);
    return NextResponse.json({ code: "DATABASE_ERROR", error: "Couldn’t save that change. Please try again." }, { status: 503 });
  }
}
