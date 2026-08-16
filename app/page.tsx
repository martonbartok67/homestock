"use client";

import {
  ClerkLoaded,
  ClerkLoading,
  RedirectToSignIn,
  Show,
} from "@clerk/nextjs";
import HomeStockApp from "./home-stock-app";

export default function Page() {
  return (
    <>
      <ClerkLoading>
        <main className="session-loading">
          <span>Opening HomeStock…</span>
        </main>
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-in">
          <HomeStockApp />
        </Show>
        <Show when="signed-out">
          <RedirectToSignIn />
        </Show>
      </ClerkLoaded>
    </>
  );
}
