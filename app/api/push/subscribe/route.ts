import { NextResponse } from "next/server";
import { requireHousehold } from "../../../../lib/server/household-auth";
import { HouseholdAccessError } from "../../../../lib/server/household-auth";
import { savePushSubscription } from "../../../../lib/server/home-stock-repository";

type SubscribeBody = {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  try {
    const household = await requireHousehold();

    // The body comes from the browser — validate each field before use so
    // a malicious client cannot store arbitrary data on this household.
    const raw = (await request.json()) as SubscribeBody;
    const endpoint = asNonEmptyString(raw.endpoint);
    const p256dh = asNonEmptyString(raw.p256dh);
    const auth = asNonEmptyString(raw.auth);
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: "Missing required fields" },
        { status: 400 },
      );
    }

    await savePushSubscription(household.householdId, endpoint, p256dh, auth);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Failed to save subscription" },
      { status: 500 },
    );
  }
}