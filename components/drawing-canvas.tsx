"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CreateResponse = {
  publicId: string;
  shareUrl: string;
  inviteUrl: string;
};

const CANVAS_SIZE = 768;
const DURATION_SECONDS = 30;

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startedRef = useRef(false);
  const finishedImageRef = useRef<Blob | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SECONDS);
  const [phase, setPhase] = useState<"ready" | "drawing" | "saving" | "error">("ready");
  const [error, setError] = useState("");

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    context.fillStyle = "#fffdf7";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.strokeStyle = "#16213d";
    context.lineWidth = 13;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const save = useCallback(async (image: Blob) => {
    setPhase("saving");
    setError("");
    idempotencyKeyRef.current ??= crypto.randomUUID();

    try {
      const formData = new FormData();
      formData.set("image", new File([image], "soul-painter.png", { type: "image/png" }));
      formData.set("idempotencyKey", idempotencyKeyRef.current);
      const response = await fetch("/api/user/create", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json()) as CreateResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "保存画作失败，请稍后重试。");

      router.push(`/p/${payload.publicId}?invite=${encodeURIComponent(payload.inviteUrl)}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存画作失败，请稍后重试。");
      setPhase("error");
    }
  }, [router]);

  const finish = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || finishedImageRef.current) return;
    drawingRef.current = false;
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("无法生成画作，请重试。");
        setPhase("error");
        return;
      }
      finishedImageRef.current = blob;
      void save(blob);
    }, "image/png");
  }, [save]);

  useEffect(() => {
    if (phase !== "drawing") return;
    if (secondsLeft === 0) {
      finish();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [finish, phase, secondsLeft]);

  const pointFor = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_SIZE,
      y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_SIZE,
    };
  };

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase === "saving" || secondsLeft === 0) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    if (!startedRef.current) {
      startedRef.current = true;
      setPhase("drawing");
    }
    const point = pointFor(event);
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || phase === "saving" || secondsLeft === 0) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = pointFor(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endStroke = () => {
    drawingRef.current = false;
  };

  const retrySave = () => {
    if (finishedImageRef.current) void save(finishedImageRef.current);
  };

  return (
    <section className="creator">
      <div className="creator-header">
        <p className="eyebrow">灵魂画友 · 第一张画</p>
        <h1>{phase === "ready" ? "落下第一笔，30 秒开始。" : "把你的灵魂画完。"}</h1>
        <p>不用画得好看，只要是你画的。</p>
      </div>

      <div className="timer" aria-live="polite">
        <span>剩余时间</span>
        <strong>{String(secondsLeft).padStart(2, "0")}</strong>
      </div>

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        aria-label="30 秒绘画画布"
        onPointerDown={beginStroke}
        onPointerMove={draw}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />

      <p className="canvas-note">
        {phase === "ready" && "手指、触控笔或鼠标都可以。"}
        {phase === "drawing" && "时间到后会自动保存并生成分享链接。"}
        {phase === "saving" && "正在把你的画存进小宇宙…"}
        {phase === "error" && error}
      </p>
      {phase === "error" && (
        <button className="button" type="button" onClick={retrySave}>
          再试一次保存
        </button>
      )}
    </section>
  );
}
