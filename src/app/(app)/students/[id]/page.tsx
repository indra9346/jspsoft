import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canViewStudent } from "@/lib/access";
import { StudentProfile } from "@/components/student-profile";

export const metadata = { title: "Student profile" };

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "students");
  const { id } = await params;
  // Server-side authorisation: admin → any student of this school; teacher → assigned sections; student → only themself.
  if (!(await canViewStudent(user, id))) notFound();
  return (
    <div className="space-y-4">
      {user.role !== "STUDENT" && <Link href="/students" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back to students</Link>}
      <StudentProfile studentId={id} viewer={user} />
    </div>
  );
}
