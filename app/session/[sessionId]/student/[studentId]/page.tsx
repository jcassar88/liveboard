import StudentCanvas from "./StudentCanvas";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ sessionId: string; studentId: string }>;
}) {
  const { sessionId, studentId } = await params;

  return <StudentCanvas sessionId={sessionId} studentId={studentId} />;
}
