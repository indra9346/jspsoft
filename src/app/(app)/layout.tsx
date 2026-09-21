import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { getUnlockedAddons } from "@/lib/features-server";
import { navFor } from "@/lib/nav";
import { avatarColor, initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [school, unlocked] = await Promise.all([getSchool(), getUnlockedAddons()]);
  return (
    <AppShell
      groups={navFor(user.role, unlocked)}
      school={{ name: school.name, logo: school.logoData }}
      user={{ name: user.name, role: user.role.toLowerCase(), initials: initials(user.name), color: avatarColor(user.email) }}
    >
      {children}
    </AppShell>
  );
}
