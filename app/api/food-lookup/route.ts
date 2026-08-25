import { NextResponse } from "next/server";
import { householdAccessResponse, requireHousehold } from "../../../lib/server/household-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireHousehold();
  } catch (error) {
    const accessResponse = householdAccessResponse(error);
    if (accessResponse) return accessResponse;
    throw error;
  }
  const barcode = new URL(request.url).searchParams.get("barcode")?.trim();
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: "Enter a valid barcode." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,categories_tags`,
      { headers: { "User-Agent": "HomeStock/1.0 (inventory app)" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) return NextResponse.json({ found: false, barcode });
    const data = await response.json() as { status?: number; product?: { product_name?: string; product_name_en?: string; brands?: string; categories_tags?: string[] } };
    if (data.status !== 1 || !data.product) return NextResponse.json({ found: false, barcode });
    const product = data.product;
    return NextResponse.json({
      found: true,
      barcode,
      name: [product.brands, product.product_name_en || product.product_name].filter(Boolean).join(" "),
      category: product.categories_tags?.some((tag) => /snack|beverage|drink|water|dairy|cheese|milk|frozen/.test(tag)) ? "Fridge" : "Pantry",
    });
  } catch {
    return NextResponse.json({ found: false, barcode });
  }
}
