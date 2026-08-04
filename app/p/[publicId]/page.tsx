import Link from "next/link";
import { notFound } from "next/navigation";

import { ShareActions } from "@/components/share-actions";
import { findPublicWork } from "@/lib/db";
import { appOrigin } from "@/lib/create-work";

type WorkPageProps = { params: Promise<{ publicId: string }> };

export default async function WorkPage({ params }: WorkPageProps) {
  const { publicId } = await params;
  const work = await findPublicWork(publicId);
  if (!work) notFound();
  const origin = appOrigin();
  const shareUrl = `${origin}/p/${work.publicId}`;
  const inviteUrl = `${origin}/invite/${work.publicId}`;

  return <main className="page-shell work-page"><p className="eyebrow">一张灵魂画</p><h1>这就是 TA 的 30 秒。</h1><img className="work-image" src={work.imageUrl} alt="一张 30 秒完成的灵魂画" /><ShareActions shareUrl={shareUrl} inviteUrl={inviteUrl} />{work.allowScribbles && <Link className="button button-secondary reply-button" href={`/invite/${publicId}`}>邀请画友接着画</Link>}{work.scribbles && work.scribbles.length > 0 && <section className="scribble-list"><h2>画友的回复</h2>{work.scribbles.map((scribble) => <article key={scribble.id} className="scribble-item"><img src={scribble.imageUrl} alt="画友添加的一层涂鸦" /><p>一位画友 · {new Date(scribble.createdAt).toLocaleDateString("zh-CN")}</p></article>)}</section>}<Link className="text-link" href="/create">我也来画一张 →</Link></main>;
}
