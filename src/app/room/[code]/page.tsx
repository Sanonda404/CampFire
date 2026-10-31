import { Suspense } from "react";
import { RoomClient } from "./RoomClient";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-muted">Finding the fire…</div>}>
      <RoomPageContent params={params} />
    </Suspense>
  );
}

async function RoomPageContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}
