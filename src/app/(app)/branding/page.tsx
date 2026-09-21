import { requireUser } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { PageHeader } from "@/components/ui";
import { BrandingForm } from "@/components/branding-form";

export const metadata = { title: "School Branding" };

export default async function BrandingPage() {
  await requireUser(["ADMIN"], "branding");
  const s = await getSchool();
  return (
    <div>
      <PageHeader title="Branding & School Settings" subtitle="School name, logo, address, contact, principal and signature — used across the app, reports and PDFs" icon="branding" color="linear-gradient(135deg,#06b6d4,#8b5cf6)" />
      <BrandingForm school={{ name: s.name, tagline: s.tagline, primaryColor: s.primaryColor, secondaryColor: s.secondaryColor, logoData: s.logoData, address: s.address, phone: s.phone, email: s.email, website: s.website, principalName: s.principalName, signatureData: s.signatureData }} />
    </div>
  );
}
