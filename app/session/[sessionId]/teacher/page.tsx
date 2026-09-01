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
        <div className="max-w-md text-left text-xs">
          <p className="mb-4 text-center text-sm">
            This view is only available to teachers, launched directly from
            Canvas.
          </p>
          <p>Looking for cookie: teacher_of_{parsed?.courseId ?? "(unparsed)"}</p>
          <p>Parsed courseId: {parsed?.courseId ?? "null"}</p>
          <p>All cookies present: {cookieStore.getAll().map((c) => c.name).join(", ") || "(none)"}</p>
        </div>
      </div>
    );
  }

  return <TeacherGrid sessionId={sessionId} />;
}