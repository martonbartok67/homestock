import { NextResponse } from "next/server";
import { requireHousehold } from "../../../../lib/server/household-auth";
import { HouseholdAccessError } from "../../../../lib/server/household-auth";
import {
  updateNotificationPreferences,
} from "../../../../lib/server/home-stock-repository";

type PreferencesBody = {
  notifyOneDay?: unknown;
  notifyThreeDays?: unknown;
  notifySevenDays?: unknown;
};

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export async function PATCH(request: Request) {
  try {
    const household = await requireHousehold();

    // Body comes from the browser — parse with a small whitelist rather than
    // a blanket `as` so an attacker cannot inject extra fields.
    const raw = (await request.json()) as PreferencesBody;
    const notifyOneDay = asBoolean(raw.notifyOneDay);
    const notifyThreeDays = asBoolean(raw.notifyThreeDays);
    const notifySevenDays = asBoolean(raw.notifySevenDays);

    // At least one preference must be supplied. Booleans only — anything else
    // (string, number, null) is silently dropped.
    if (
      notifyOneDay === undefined &&
      notifyThreeDays === undefined &&
      notifySevenDays === undefined
    ) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          error: "At least one preference must be provided",
        },
        { status: 400 },
      );
    }

    // Partial update: only the fields the caller actually sent are written.
    // Fields the caller omits keep their current value automatically.
    await updateNotificationPreferences(household.householdId, {
      ...(notifyOneDay !== undefined && { notifyOneDay }),
      ...(notifyThreeDays !== undefined && { notifyThreeDays }),
      ...(notifySevenDays !== undefined && { notifySevenDays }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}