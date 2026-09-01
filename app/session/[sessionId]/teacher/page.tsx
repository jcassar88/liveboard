import { cookies } from "next/headers";
import TeacherGrid from "./TeacherGrid";

function parseSessionId(id: string): { courseId: string; date: string } | null {
  const match = id.match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { courseId: match[1], date: match[2] };
}

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const parsed = parseSessionId(sessionId);

  const cookieStore = await cookies();
  const isVerifiedTeacher =
    parsed && cookieStore.get(`teacher_of_${parsed.courseId}`)?.value === "1";

  if (!isVerifiedTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-center text-neutral-100">
        <p className="max-w-sm">
          This view is only available to teachers, launched directly from
          Canvas. Please open Live Whiteboard from your course in Canvas.
        </p>
      </div>
    );
  }

  return <TeacherGrid sessionId={sessionId} />;
}