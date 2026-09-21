import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.advanced_transport.title };

export default function Page() {
  return <LockedFeature feature="advanced_transport" />;
}
