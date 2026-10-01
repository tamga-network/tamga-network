/** Kapı: durum yüklenince tanıtım / kilit / sekmelere yönlendirir. */
import React from "react";
import { Redirect } from "expo-router";
import { Spinner } from "@/ui";
import { useWallet } from "@/state/wallet";

export default function Gate() {
  const { ready, state, hasPinSet, unlocked } = useWallet();
  if (!ready) return <Spinner />;
  if (!state || !hasPinSet) return <Redirect href="/welcome" />;
  if (!unlocked) return <Redirect href="/lock" />;
  return <Redirect href="/(tabs)" />;
}
