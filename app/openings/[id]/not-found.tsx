import Link from "next/link";
import { SimplePage } from "@/components/ui/simple-page";
export default function NotFound() { return <SimplePage title="Opening not found" description="This opening is unavailable in your account."><Link href="/openings">Back to openings</Link></SimplePage>; }
