import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import webpush from "web-push";
import {
  getExpiringItems,
  getHouseholdsWithPushSubscriptions,
  removePushSubscriptionByEndpoint,
} from "../../../../lib/server/home-stock-repository";
import type {
  ExpiringItem,
} from "../../../../lib/server/home-stock-repository";

const vapidEmail = process.env.VAPID_EMAIL ?? "";
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";

if (vapidEmail && vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

function safeEquals(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  // Vercel cron jobs send `Authorization: Bearer <CRON_SECRET>`. Reject the
  // request before doing any DB work if the header is missing or wrong.
  const provided = extractBearer(request.headers.get("Authorization"));
  if (!provided || !safeEquals(provided, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If VAPID was not configured, fail loud rather than silently no-oping —
  // a misconfigured deployment should be obvious in the cron logs.
  if (!vapidEmail || !vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      { error: "VAPID keys are not configured" },
      { status: 500 },
    );
  }

  const households = await getHouseholdsWithPushSubscriptions();

  let sentCount = 0;
  let removedCount = 0;
  for (const household of households) {
    // (The SQL `WHERE` clause in getHouseholdsWithPushSubscriptions already
    // excludes households with no notification preference enabled, so we no
    // longer need to filter in JS here.)

    const expiringItems: ExpiringItem[] = [];
    if (household.notifyOneDay) {
      expiringItems.push(...(await getExpiringItems(household.householdId, 1)));
    }
    if (household.notifyThreeDays) {
      expiringItems.push(...(await getExpiringItems(household.householdId, 3)));
    }
    if (household.notifySevenDays) {
      expiringItems.push(...(await getExpiringItems(household.householdId, 7)));
    }

    // Deduplicate — an item can match more than one threshold.
    const seenIds = new Set<string>();
    const uniqueItems = expiringItems.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
    if (uniqueItems.length === 0) continue;

    const itemList = uniqueItems
      .map((item) => `${item.name} (in ${item.daysUntil}d)`)
      .join(", ");

    const pushSubscription = {
      endpoint: household.endpoint,
      keys: { p256dh: household.p256dh, auth: household.auth },
    };
    const payload = JSON.stringify({
      title: "HomeStock expiry reminder",
      body: `${uniqueItems.length} item${
        uniqueItems.length > 1 ? "s" : ""
      } expiring soon: ${itemList}`,
      url: "/",
    });

    try {
      await webpush.sendNotification(pushSubscription, payload);
      sentCount++;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      // 404 / 410 from the push service means the endpoint is gone — drop
      // the row so we don't retry forever. Anything else is logged only.
      if (statusCode === 404 || statusCode === 410) {
        try {
          // Only drop the dead endpoint — a household may have several devices,
          // and we don't want to unsubscribe the working ones.
          await removePushSubscriptionByEndpoint(household.endpoint);
          removedCount++;
        } catch (cleanupError) {
          console.error(
            `Failed to remove dead push subscription for ${household.householdId}:`,
            cleanupError,
          );
        }
      } else {
        console.error(
          `Failed to send push notification to household ${household.householdId}:`,
          error,
        );
      }
    }
  }

  return NextResponse.json({
    sent: sentCount,
    householdsChecked: households.length,
    subscriptionsRemoved: removedCount,
  });
}