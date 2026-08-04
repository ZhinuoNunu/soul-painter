"use client";

import { useRouter } from "next/navigation";

export function InviteDoodleButton({ publicId }: { publicId: string }) {
  const router = useRouter();
  async function start() {
    const response = await fetch(`/api/invites/${publicId}`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return;
    router.push(`/p/${publicId}/doodle`);
  }
  return <button className="button" type="button" onClick={() => void start()}>在这张画上接着画 <span aria-hidden>→</span></button>;
}
