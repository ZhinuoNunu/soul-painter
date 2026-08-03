"use client";

import { useState } from "react";

type ShareActionsProps = {
  shareUrl: string;
  inviteUrl: string;
};

export function ShareActions({ shareUrl, inviteUrl }: ShareActionsProps) {
  const [copied, setCopied] = useState<"" | "share" | "invite">("");

  async function copy(value: string, type: "share" | "invite") {
    await navigator.clipboard.writeText(value);
    setCopied(type);
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "我的灵魂画", url: shareUrl });
      return;
    }
    await copy(shareUrl, "share");
  }

  return (
    <div className="share-actions">
      <button className="button" type="button" onClick={() => void share()}>
        分享这张画
      </button>
      <button className="button button-secondary" type="button" onClick={() => void copy(inviteUrl, "invite")}>
        {copied === "invite" ? "邀请链接已复制" : "复制邀请链接"}
      </button>
      {copied === "share" && <span className="microcopy">作品链接已复制。</span>}
    </div>
  );
}
