import { NextResponse } from "next/server";
import { getSnapshot } from "../../../../lib/server/home-stock-repository";
import { suggestRecipeFromInventory } from "../../../../lib/server/online-recipe-suggestion";
import { householdAccessResponse, requireHousehold } from "../../../../lib/server/household-auth";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Recipe suggestion failed.";
}

export async function POST(request: Request) {
  try {
    const { householdId } = await requireHousehold();
    const body = await request.json().catch(() => ({})) as {
      mode?: string;
      typeFilter?: string;
      excludeIds?: string[];
      excludeNames?: string[];
      excludeUrls?: string[];
      excludeFamilies?: string[];
    };
    const snapshot = await getSnapshot(householdId);
    const suggestion = await suggestRecipeFromInventory({
      inventory: snapshot.inventory,
      recipes: snapshot.recipes,
      mode: body.mode ?? "use-what-i-have",
      typeFilter: body.typeFilter ?? "All",
      excludeIds: body.excludeIds ?? [],
      excludeNames: body.excludeNames ?? [],
      excludeUrls: body.excludeUrls ?? [],
      excludeFamilies: body.excludeFamilies ?? [],
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    const accessResponse = householdAccessResponse(error);
    if (accessResponse) return accessResponse;
    const message = errorMessage(error);
    const status = message === "Add some food items to inventory first." ? 400 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
