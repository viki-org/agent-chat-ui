"use client";

import React, { useMemo } from "react";

// Configuration
const GROUPS_PER_SIZE = 2; // Number of groups per star size (1-3 recommended)
const TOTAL_SMALL_STARS = 900;
const TOTAL_MEDIUM_STARS = 350;
const TOTAL_LARGE_STARS = 150;

// Generate random star positions - use larger spread for full coverage
function generateStars(count: number): string {
  const stars: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 4000);
    const y = Math.floor(Math.random() * 4000);
    stars.push(`${x}px ${y}px currentColor`);
  }
  return stars.join(", ");
}

// Animation keyframes for each group
const twinkleAnimations = [
  "twinkle1",
  "twinkle2",
  "twinkle3",
  "twinkle4",
  "twinkle5",
  "twinkle6",
];

export function UniverseBackground() {
  // Generate star groups based on GROUPS_PER_SIZE
  const smallStarGroups = useMemo(
    () =>
      Array.from({ length: GROUPS_PER_SIZE }, () =>
        generateStars(Math.floor(TOTAL_SMALL_STARS / GROUPS_PER_SIZE)),
      ),
    [],
  );

  const mediumStarGroups = useMemo(
    () =>
      Array.from({ length: GROUPS_PER_SIZE }, () =>
        generateStars(Math.floor(TOTAL_MEDIUM_STARS / GROUPS_PER_SIZE)),
      ),
    [],
  );

  const largeStarGroups = useMemo(
    () =>
      Array.from({ length: GROUPS_PER_SIZE }, () =>
        generateStars(Math.floor(TOTAL_LARGE_STARS / GROUPS_PER_SIZE)),
      ),
    [],
  );

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-indigo-50 to-cyan-50 dark:from-gray-950 dark:via-slate-900 dark:to-black" />

      {/* Nebula/Galaxy effect - gradient blobs */}
      <div className="absolute inset-0 opacity-30 dark:opacity-40">
        <div className="absolute top-1/4 -left-1/4 h-[500px] w-[500px] animate-[drift_60s_ease-in-out_infinite] rounded-full bg-gradient-to-br from-indigo-300/50 to-transparent blur-3xl dark:from-indigo-900/50" />
        <div className="absolute top-1/2 right-1/4 h-[400px] w-[400px] animate-[drift_80s_ease-in-out_infinite_reverse] rounded-full bg-gradient-to-br from-cyan-300/50 to-transparent blur-3xl dark:from-cyan-800/50" />
        <div className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] animate-[drift_70s_ease-in-out_infinite] rounded-full bg-gradient-to-br from-purple-300/40 to-transparent blur-3xl dark:from-purple-900/40" />
      </div>

      {/* Small stars - dynamically generated groups */}
      {smallStarGroups.map((stars, i) => (
        <div
          key={`small-${i}`}
          className={`absolute h-[2px] w-[2px] text-slate-700 dark:h-[1px] dark:w-[1px] dark:text-white`}
          style={{
            boxShadow: stars,
            animation: `${twinkleAnimations[i % twinkleAnimations.length]} ${90 + i * 15}s linear infinite`,
          }}
        />
      ))}

      {/* Medium stars - dynamically generated groups */}
      {mediumStarGroups.map((stars, i) => (
        <div
          key={`medium-${i}`}
          className="absolute h-[2px] w-[2px] text-slate-800 dark:text-cyan-100"
          style={{
            boxShadow: stars,
            animation: `${twinkleAnimations[(i + 2) % twinkleAnimations.length]} ${130 + i * 20}s linear infinite`,
          }}
        />
      ))}

      {/* Large stars - dynamically generated groups */}
      {largeStarGroups.map((stars, i) => (
        <div
          key={`large-${i}`}
          className="absolute h-[3px] w-[3px] rounded-full text-indigo-700 dark:text-cyan-200"
          style={{
            boxShadow: stars,
            animation: `${twinkleAnimations[(i + 4) % twinkleAnimations.length]} ${180 + i * 20}s linear infinite`,
          }}
        />
      ))}

      {/* Add keyframes via style tag */}
      <style jsx>{`
        @keyframes twinkle1 {
          0% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(-80px, -300px);
          }
          40% {
            transform: translate(120px, -600px);
          }
          60% {
            transform: translate(-40px, -900px);
          }
          80% {
            transform: translate(60px, -450px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        @keyframes twinkle2 {
          0% {
            transform: translate(0, 0);
          }
          15% {
            transform: translate(150px, -200px);
          }
          35% {
            transform: translate(-100px, -500px);
          }
          55% {
            transform: translate(80px, -800px);
          }
          75% {
            transform: translate(-60px, -400px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        @keyframes twinkle3 {
          0% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-120px, -400px);
          }
          50% {
            transform: translate(60px, -700px);
          }
          75% {
            transform: translate(-80px, -350px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        @keyframes twinkle4 {
          0% {
            transform: translate(0, 0);
          }
          18% {
            transform: translate(100px, -250px);
          }
          42% {
            transform: translate(-70px, -550px);
          }
          68% {
            transform: translate(110px, -300px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        @keyframes twinkle5 {
          0% {
            transform: translate(0, 0);
          }
          30% {
            transform: translate(-90px, -350px);
          }
          60% {
            transform: translate(40px, -650px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        @keyframes twinkle6 {
          0% {
            transform: translate(0, 0);
          }
          22% {
            transform: translate(70px, -280px);
          }
          48% {
            transform: translate(-130px, -520px);
          }
          72% {
            transform: translate(50px, -780px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        @keyframes drift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -20px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 30px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
