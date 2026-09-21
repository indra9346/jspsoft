import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.notifications.variants!["whatsapp"].title };

export default function Page() {
  return <LockedFeature feature="notifications" variant="whatsapp" />;
}
