import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing page-shell">
      <p className="eyebrow">SOUL PAINTER</p>
      <h1>30 秒，画一张<br />只属于你的画。</h1>
      <p className="lede">不用会画画。给自己 30 秒，把脑海里的东西留在纸上。</p>
      <Link className="button" href="/create">开始创作 <span aria-hidden>→</span></Link>
      <p className="microcopy">画完立即生成公开作品页与邀请链接。</p>
    </main>
  );
}
