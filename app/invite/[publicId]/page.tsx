import { notFound } from "next/navigation";

import { InviteDoodleButton } from "@/components/invite-doodle-button";
import { findPublicWork } from "@/lib/db";

export default async function InvitePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const work = await findPublicWork(publicId);
  if (!work) notFound();

  return <main className="page-shell invite-page"><p className="eyebrow">你收到一张灵魂画</p><h1>有人邀请你，也画下自己的 30 秒。</h1><img className="work-image" src={work.imageUrl} alt="朋友完成的一张灵魂画" /><p className="lede">原画不会改变，你的涂鸦会作为一条独立回复添加。</p><InviteDoodleButton publicId={publicId} /></main>;
}
