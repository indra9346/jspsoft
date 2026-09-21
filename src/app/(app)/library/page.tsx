import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.library.title };

export default function Page() {
  return <LockedFeature feature="library" />;
}
