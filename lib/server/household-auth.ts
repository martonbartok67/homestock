import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getHouseholdForEmail } from "./home-stock-repository";

export class HouseholdAccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
    readonly code: "UNAUTHORIZED" | "HOUSEHOLD_REQUIRED",
  ) {
    super(message);
    this.name = "HouseholdAccessError";
  }
}

export async function requireHousehold() {
  const { userId } = await auth();

  if (!userId) {
    throw new HouseholdAccessError(
      "Please sign in to continue.",
      401,
      "UNAUTHORIZED",
    );
  }
  const user = await currentUser();
  const emailAddress = user?.primaryEmailAddress;
  if (!emailAddress || emailAddress.verification?.status !== "verified") {
    throw new HouseholdAccessError(
      "Please verify your email before using HomeStock.",
      403,
      "HOUSEHOLD_REQUIRED",
    );
  }

  const household = await getHouseholdForEmail(emailAddress.emailAddress);
  if (!household) {
    throw new HouseholdAccessError(
      "This email has not been added to a HomeStock household yet.",
      403,
      "HOUSEHOLD_REQUIRED",
    );
  }

  return { userId, householdId: household.id, household };
}

export function householdAccessResponse(error: unknown) {
  if (!(error instanceof HouseholdAccessError)) return null;
  return NextResponse.json(
    { code: error.code, error: error.message },
    { status: error.status },
  );
}
