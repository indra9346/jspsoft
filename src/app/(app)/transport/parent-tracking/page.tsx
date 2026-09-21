import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.gps.variants!["parent-tracking"].title };

export default function Page() {
  return <LockedFeature feature="gps" variant="parent-tracking" />;
}
