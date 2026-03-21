import { Suspense } from "react";
import InstructorCourseEditorClient from "./course-editor-client";

export default function InstructorCourseEditorPage({ params }: { params: { courseId: string } }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
          <p className="mono-note">Loading course editor...</p>
        </div>
      }
    >
      <InstructorCourseEditorClient params={params} />
    </Suspense>
  );
}
