import { LockedFeature } from "@/components/locked";
import { LOCKED } from "@/lib/features";

export const metadata = { title: LOCKED.non_teaching_staff.title };

export default function Page() {
  return <LockedFeature feature="non_teaching_staff" />;
}
