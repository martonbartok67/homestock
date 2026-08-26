import { NextResponse } from "next/server";
import { requireHousehold } from "../../../../lib/server/household-auth";
import { HouseholdAccessError } from "../../../../lib/server/household-auth";
import {
  removePushSubscription,
  removePushSubscriptionByEndpoint,
} from "../../../../lib/server/home-stock-repository";

type UnsubscribeBody = { endpoint?: unknown };

export async function DELETE(request: Request) {
  try {
    const household = await requireHousehold();

    // The client sends its own subscription endpoint so we can remove only
    // that device. If no endpoint is provided (older client, or "remove all"),
    // fall back to removing every subscription for the household.
    let endpoint: string | undefined;
    try {
      const raw = (await request.json()) as UnsubscribeBody;
      if (typeof raw.endpoint === "string" && raw.endpoint.length > 0) {
        endpoint = raw.endpoint;
      }
    } catch {
      // No body or unparseable body — treat as "remove all".
    }

    if (endpoint) {
      await removePushSubscriptionByEndpoint(endpoint);
    } else {
      await removePushSubscription(household.householdId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Failed to remove subscription" },
      { status: 500 },
    );
  }
}