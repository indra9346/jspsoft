import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.advanced_transport.variants!["driver-app"].title };

export default function Page() {
  return <LockedFeature feature="advanced_transport" variant="driver-app" />;
}
