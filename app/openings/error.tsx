"use client";
import { SimplePage } from "@/components/ui/simple-page";
export default function ErrorPage({ retry }: { retry: () => void }) { return <SimplePage title="Openings unavailable" description="Could not load your repertoire. Please try again."><button className="rounded-lg border p-3" onClick={() => retry()}>Try again</button></SimplePage>; }
