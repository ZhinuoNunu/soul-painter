"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { mode?: "create" | "scribble"; targetPublicId?: string; inviteToken?: string; baseImageUrl?: string };
type CreateResponse = { publicId: string; shareUrl: string; inviteUrl: string };
const SIZE = 768, DURATION = 30;
const COLORS = [{ label: "深蓝", value: "#16213d" }, { label: "珊瑚红", value: "#f77f63" }, { label: "向日黄", value: "#e8a51d" }, { label: "森林绿", value: "#397a59" }, { label: "葡萄紫", value: "#7853a6" }];
const SIZES = [{ label: "细", value: 7 }, { label: "中", value: 13 }, { label: "粗", value: 21 }];

export function DrawingCanvas({ mode = "create", targetPublicId, inviteToken, baseImageUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null), drawingRef = useRef(false), startedRef = useRef(false), finishedRef = useRef<Blob | null>(null), keyRef = useRef<string | null>(null);
  const router = useRouter();
  const [seconds, setSeconds] = useState(DURATION), [phase, setPhase] = useState<"ready" | "drawing" | "saving" | "error">("ready"), [color, setColor] = useState(COLORS[0].value), [size, setSize] = useState(SIZES[1].value), [error, setError] = useState("");

  useEffect(() => { const canvas = canvasRef.current, context = canvas?.getContext("2d"); if (!canvas || !context) return; canvas.width = SIZE; canvas.height = SIZE; if (mode === "create") { context.fillStyle = "#fffdf7"; context.fillRect(0, 0, SIZE, SIZE); } context.lineCap = "round"; context.lineJoin = "round"; }, [mode]);
  const save = useCallback(async (image: Blob) => {
    setPhase("saving"); setError(""); keyRef.current ??= crypto.randomUUID();
    try {
      const form = new FormData(); form.set("image", new File([image], mode === "create" ? "soul-painter.png" : "doodle.png", { type: "image/png" })); form.set("idempotencyKey", keyRef.current);
      let url = "/api/user/create";
      if (mode === "scribble") { url = "/api/scribbles"; form.set("targetPublicId", targetPublicId ?? ""); form.set("inviteToken", inviteToken ?? ""); }
      const response = await fetch(url, { method: "POST", body: form, credentials: "same-origin" }); const payload = await response.json() as (CreateResponse & { error?: string });
      if (!response.ok) throw new Error(payload.error ?? "保存失败，请稍后重试。");
      router.push(mode === "create" ? `/p/${payload.publicId}` : `/p/${targetPublicId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请稍后重试。"); setPhase("error"); }
  }, [inviteToken, mode, router, targetPublicId]);
  const finish = useCallback(() => { const canvas = canvasRef.current; if (!canvas || !startedRef.current || finishedRef.current || phase === "saving") return; drawingRef.current = false; setSeconds(0); canvas.toBlob((blob) => { if (!blob) { setError("无法生成画作，请重试。"); setPhase("error"); return; } finishedRef.current = blob; void save(blob); }, "image/png"); }, [phase, save]);
  useEffect(() => { if (phase !== "drawing") return; if (seconds === 0) { finish(); return; } const id = window.setTimeout(() => setSeconds((value) => value - 1), 1000); return () => window.clearTimeout(id); }, [finish, phase, seconds]);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const box = canvasRef.current!.getBoundingClientRect(); return { x: (event.clientX - box.left) / box.width * SIZE, y: (event.clientY - box.top) / box.height * SIZE }; };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { if (phase === "saving" || seconds === 0) return; const canvas = canvasRef.current, context = canvas?.getContext("2d"); if (!canvas || !context) return; if (!startedRef.current) { startedRef.current = true; setPhase("drawing"); } const position = point(event); drawingRef.current = true; canvas.setPointerCapture(event.pointerId); context.strokeStyle = color; context.lineWidth = size; context.beginPath(); context.moveTo(position.x, position.y); };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawingRef.current || phase === "saving" || seconds === 0) return; const context = canvasRef.current?.getContext("2d"); if (!context) return; const position = point(event); context.lineTo(position.x, position.y); context.stroke(); };
  return <section className="creator"><div className="creator-header"><p className="eyebrow">灵魂画友 · {mode === "create" ? "第一张画" : "接着画"}</p><h1>{phase === "ready" ? "落下第一笔，30 秒开始。" : "把这一笔画完。"}</h1><p>{mode === "create" ? "不用画得好看，只要是你画的。" : "原画不会改变，你的涂鸦会作为独立回复保存。"}</p></div><div className="timer" aria-live="polite"><span>剩余时间</span><strong>{String(seconds).padStart(2, "0")}</strong></div><div className="drawing-tools"><div><span>颜色</span>{COLORS.map((item) => <button key={item.value} type="button" className="color-swatch" style={{ backgroundColor: item.value }} aria-label={item.label} aria-pressed={color === item.value} onClick={() => setColor(item.value)} />)}</div><div><span>粗细</span>{SIZES.map((item) => <button key={item.value} type="button" className="size-button" aria-pressed={size === item.value} onClick={() => setSize(item.value)}>{item.label}</button>)}</div></div><div className={`canvas-stack ${mode === "scribble" ? "with-base" : ""}`}>{baseImageUrl && <img src={baseImageUrl} alt="作为底图的原画" className="canvas-base" />}{/* Overlay keeps the original immutable and avoids cross-origin canvas export issues. */}<canvas ref={canvasRef} className="drawing-canvas" aria-label="30 秒绘画画布" onPointerDown={start} onPointerMove={draw} onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }} onPointerLeave={() => { drawingRef.current = false; }} /></div><p className="canvas-note">{phase === "ready" && "手指、触控笔或鼠标都可以。"}{phase === "drawing" && "时间到后会自动保存；也可以提前完成。"}{phase === "saving" && "正在保存…"}{phase === "error" && error}</p>{phase === "drawing" && <button className="button" type="button" onClick={finish}>完成绘画</button>}{phase === "error" && <button className="button" type="button" onClick={() => finishedRef.current && void save(finishedRef.current)}>再试一次保存</button>}</section>;
}
