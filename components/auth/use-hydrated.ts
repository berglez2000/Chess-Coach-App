"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
// Keep password forms disabled until React has attached their submit handler.
export function useHydrated() { return useSyncExternalStore(subscribe, () => true, () => false); }
