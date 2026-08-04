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
  return <main className="page-shell work-page"><p className="eyebrow">一张灵魂画</p><h1>这就是 TA 的 30 秒。</h1><img className="work-image" src={work.imageUrl} alt="一张 30 秒完成的灵魂画" /><ShareActions shareUrl={`${origin}/p/${work.publicId}`} inviteUrl={`${origin}/invite/${work.publicId}`} />{work.scribbles && work.scribbles.length > 0 && <section className="scribble-list"><h2>画友的回复</h2>{work.scribbles.map((scribble) => <article key={scribble.id} className="scribble-item"><img src={scribble.imageUrl} alt="画友添加的一层涂鸦" /><p>一位画友 · {new Date(scribble.createdAt).toLocaleDateString("zh-CN")}</p></article>)}</section>}</main>;
}
