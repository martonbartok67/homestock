import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { WelcomeProfile } from "../welcome";
import { getHouseholdForEmail } from "./home-stock-repository";

const welcomeProfilesByEmail: Record<string, WelcomeProfile> = {
  "balint.aliz.eszter@gmail.com": { name: "Lizi", tone: "sunshine" },
  "horvathemmalola@gmail.com": { name: "Emma", tone: "sunshine" },
  "frigyes.o.endersz@gmail.com": { name: "Frici", tone: "asshole" },
  "marcibartok07@gmail.com": { name: "Marci", tone: "unc" },
};

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

  const welcomeProfile = welcomeProfilesByEmail[
    emailAddress.emailAddress.trim().toLowerCase()
  ] ?? null;

  return { userId, householdId: household.id, household, welcomeProfile };
}

export function householdAccessResponse(error: unknown) {
  if (!(error instanceof HouseholdAccessError)) return null;
  return NextResponse.json(
    { code: error.code, error: error.message },
    { status: error.status },
  );
}
