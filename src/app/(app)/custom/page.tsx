import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.custom_integrations.title };

export default function Page() {
  return <LockedFeature feature="custom_integrations" />;
}
