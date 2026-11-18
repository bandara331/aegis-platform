"use client";

import { useEffect, useRef, useState } from "react";

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface Bolt {
  points: { x: number; y: number }[];
  branches: { x: number; y: number }[][];
  born: number;
}

const STORAGE_KEY = "aegis_storm_fx";

function buildBolt(width: number, height: number): Bolt {
  const startX = width * (0.15 + Math.random() * 0.7);
  const points: { x: number; y: number }[] = [{ x: startX, y: -10 }];
  const branches: { x: number; y: number }[][] = [];
  const endY = height * (0.45 + Math.random() * 0.3);
  let x = startX;
  let y = -10;
  while (y < endY) {
    y += 18 + Math.random() * 34;
    x += (Math.random() - 0.5) * 70;
    points.push({ x, y });
    if (Math.random() < 0.22) {
      const branch: { x: number; y: number }[] = [{ x, y }];
      let bx = x;
      let by = y;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const steps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < steps; i++) {
        by += 16 + Math.random() * 26;
        bx += dir * (10 + Math.random() * 36);
        branch.push({ x: bx, y: by });
      }
      branches.push(branch);
    }
  }
  return { points, branches, born: performance.now() };
}

export function StormBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "off") setEnabled(false);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduceMotion) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let width = 0;
    let height = 0;
    let drops: Drop[] = [];
    let bolt: Bolt | null = null;
    let flash = 0;
    let nextStrike = performance.now() + 4000 + Math.random() * 5000;
    let raf = 0;
    let running = true;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width;
      canvas!.height = height;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      const count = Math.max(70, Math.min(160, Math.floor(width / 10)));
      drops = Array.from({ length: count }, () => ({
        x: Math.random() * (width + 200) - 100,
        y: Math.random() * height,
        len: 10 + Math.random() * 20,
        speed: 14 + Math.random() * 14,
        alpha: 0.18 + Math.random() * 0.34,
      }));
    }

    function frame(now: number) {
      if (!running) return;
      ctx!.clearRect(0, 0, width, height);

      // Distant forest-canopy cloud shadow bands
      const cloud = ctx!.createLinearGradient(0, 0, 0, height * 0.55);
      cloud.addColorStop(0, "rgba(15, 35, 27, 0.34)");
      cloud.addColorStop(1, "rgba(15, 35, 27, 0)");
      ctx!.fillStyle = cloud;
      ctx!.fillRect(0, 0, width, height * 0.55);

      // Lightning scheduling
      if (now >= nextStrike) {
        bolt = buildBolt(width, height);
        flash = 1;
        nextStrike = now + 7000 + Math.random() * 9000;
      }

      // Forest-sage rain
      ctx!.lineCap = "round";
      for (const d of drops) {
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(24, 54, 42, ${d.alpha})`;
        ctx!.lineWidth = 1.1;
        ctx!.moveTo(d.x, d.y);
        ctx!.lineTo(d.x - d.len * 0.25, d.y + d.len);
        ctx!.stroke();
        d.y += d.speed;
        d.x -= d.speed * 0.25;
        if (d.y > height) {
          d.y = -d.len;
          d.x = Math.random() * (width + 200) - 100;
        }
      }

      // Silver-sage lightning bolt + flash
      if (bolt) {
        const age = now - bolt.born;
        const flicker = age < 90 ? 1 : age < 160 ? 0.25 : age < 260 ? 0.95 : Math.max(0, 1 - (age - 260) / 520);
        if (flicker <= 0.01) {
          bolt = null;
        } else {
          const drawPath = (pts: { x: number; y: number }[]) => {
            ctx!.beginPath();
            ctx!.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx!.lineTo(pts[i].x, pts[i].y);
            ctx!.stroke();
          };
          ctx!.save();
          ctx!.shadowColor = `rgba(175, 220, 195, ${flicker})`;
          ctx!.shadowBlur = 24;
          ctx!.strokeStyle = `rgba(195, 232, 210, ${flicker * 0.9})`;
          ctx!.lineWidth = 5;
          drawPath(bolt.points);
          ctx!.strokeStyle = `rgba(255, 255, 255, ${flicker})`;
          ctx!.lineWidth = 2;
          drawPath(bolt.points);
          ctx!.lineWidth = 1.3;
          for (const b of bolt.branches) drawPath(b);
          ctx!.restore();
          flash = Math.max(flash, flicker * 0.9);
        }
      }

      if (flash > 0.01) {
        ctx!.fillStyle = `rgba(225, 240, 232, ${flash * 0.45})`;
        ctx!.fillRect(0, 0, width, height);
        flash *= 0.9;
      }

      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, ready]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  }

  return (
    <>
      <canvas ref={canvasRef} className="storm-canvas" aria-hidden="true" />
      <button
        type="button"
        className="storm-toggle"
        onClick={toggle}
        aria-pressed={enabled}
        title={enabled ? "Turn off rain & thunder effects" : "Turn on rain & thunder effects"}
      >
        <span aria-hidden="true">{enabled ? "⛈" : "☁"}</span>
        <span>{enabled ? "Storm FX on" : "Storm FX off"}</span>
      </button>
    </>
  );
}
