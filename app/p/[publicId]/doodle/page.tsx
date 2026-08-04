import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { DrawingCanvas } from "@/components/drawing-canvas";
import { findReplyTarget } from "@/lib/db";

export default async function DoodlePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const work = await findReplyTarget(publicId);
  const cookieStore = await cookies();
  if (!work || !work.allowScribbles || process.env.SCRIBBLES_ENABLED !== "true" || cookieStore.get("soul_painter_invite")?.value !== publicId) notFound();

  return <main className="page-shell create-page"><DrawingCanvas mode="scribble" targetPublicId={publicId} baseImageUrl={work.imageUrl} /></main>;
}
