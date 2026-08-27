import TeacherGrid from "./TeacherGrid";

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <TeacherGrid sessionId={sessionId} />;
}
