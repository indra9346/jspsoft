import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getSchool } from "@/lib/school";

export const dynamic = "force-dynamic";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSchool();
  return {
    title: { default: school.name, template: `%s · ${school.name}` },
    description: `${school.name} — School Management System by Swan Digital Solutions`,
    icons: { icon: "/swan-logo.png" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const school = await getSchool();
  return (
    <html
      lang="en"
      className={jakarta.variable}
      style={{ "--brand": school.primaryColor, "--brand2": school.secondaryColor } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
