import { NextResponse } from "next/server";
import { requireHousehold } from "../../../../lib/server/household-auth";
import { HouseholdAccessError } from "../../../../lib/server/household-auth";

/**
 * Returns the VAPID public key so the browser can subscribe to push
 * notifications. Reading the key server-side avoids baking it into
 * the JS bundle via NEXT_PUBLIC_* at build time, which means:
 *   - the key is never accidentally exposed in the public bundle,
 *   - rotating the key does not require a rebuild,
 *   - missing env on a fresh deployment fails loudly here (server
 *     logs) instead of silently disabling notifications in the UI.
 */
export async function GET() {
  try {
    // Require an authenticated household so an anonymous client
    // cannot probe the key. The key is "public" by design, but
    // gating it keeps a single authed entry point.
    await requireHousehold();

    const vapidKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
    if (!vapidKey) {
      return NextResponse.json(
        {
          code: "NOT_CONFIGURED",
          error: "VAPID_PUBLIC_KEY is not set on the server.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ publicKey: vapidKey });
  } catch (error) {
    if (error instanceof HouseholdAccessError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Failed to load VAPID public key" },
      { status: 500 },
    );
  }
}
