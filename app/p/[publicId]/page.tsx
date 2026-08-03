import Link from "next/link";
import { notFound } from "next/navigation";

import { ShareActions } from "@/components/share-actions";
import { findPublicWork } from "@/lib/db";
import { appOrigin } from "@/lib/create-work";

type WorkPageProps = {
  params: Promise<{ publicId: string }>;
};

export default async function WorkPage({ params }: WorkPageProps) {
  const { publicId } = await params;
  const work = await findPublicWork(publicId);
  if (!work) notFound();

  const origin = appOrigin();
  const shareUrl = `${origin}/p/${work.publicId}`;
  const inviteUrl = `${origin}/invite/${work.publicId}`;

  return (
    <main className="page-shell work-page">
      <p className="eyebrow">一张灵魂画</p>
      <h1>这就是 TA 的 30 秒。</h1>
      {/* External Vercel Blob URLs are rendered directly to avoid image-optimization writes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="work-image" src={work.imageUrl} alt="一张 30 秒完成的灵魂画" />
      <ShareActions shareUrl={shareUrl} inviteUrl={inviteUrl} />
      <Link className="text-link" href="/create">我也来画一张 →</Link>
    </main>
  );
}
