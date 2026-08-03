import Link from "next/link";
import { notFound } from "next/navigation";

import { findPublicWork } from "@/lib/db";

export default async function InvitePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const work = await findPublicWork(publicId);
  if (!work) notFound();

  return (
    <main className="page-shell invite-page">
      <p className="eyebrow">你收到一张灵魂画</p>
      <h1>有人邀请你，也画下自己的 30 秒。</h1>
      {/* External Vercel Blob URLs are rendered directly to avoid image-optimization writes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="work-image" src={work.imageUrl} alt="朋友完成的一张灵魂画" />
      <p className="lede">先看看 TA 的画，再留下一张属于你的。</p>
      <Link className="button" href="/create">我也来画 <span aria-hidden>→</span></Link>
    </main>
  );
}
