"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export type CharacterState = "idle" | "attack" | "hit" | "ko" | "victory";

export interface TickEvent {
  direction: "up" | "down" | "flat";
  attacker: "bull" | "bear";
  damage: number;
  isCombo: boolean;
  isCritical: boolean;
  impactPoint: [number, number, number];
}

export interface CanvasHandle {
  triggerTick: (event: TickEvent) => void;
  triggerKO: (loser: "bull" | "bear") => void;
  triggerVictory: (winner: "bull" | "bear") => void;
}

/* ─── Helpers ────────────────────────────────────────────── */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ─── Bull Character ─────────────────────────────────────── */

function BullCharacter({ stateRef }: { stateRef: React.RefObject<{ state: CharacterState; timer: number }> }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshToonMaterial>(null);
  const baseX = -2.8;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g || !stateRef.current) return;
    const { state, timer } = stateRef.current;
    const t = clock.elapsedTime;

    if (state === "idle") {
      g.position.x = lerp(g.position.x, baseX, 0.08);
      g.position.y = lerp(g.position.y, Math.sin(t * 1.4) * 0.06, 0.1);
      g.rotation.z = lerp(g.rotation.z, 0, 0.1);
    } else if (state === "attack") {
      const progress = Math.min(1, (Date.now() / 1000 - timer) / 0.35);
      const punch = Math.sin(progress * Math.PI);
      g.position.x = baseX + punch * 1.2;
      g.position.y = 0;
      if (progress >= 1) stateRef.current.state = "idle";
    } else if (state === "hit") {
      const progress = Math.min(1, (Date.now() / 1000 - timer) / 0.4);
      g.position.x = lerp(g.position.x, baseX - 0.5 * (1 - progress), 0.15);
      if (bodyMatRef.current) {
        const flash = 1 - progress;
        bodyMatRef.current.color.setRGB(
          lerp(0.133, 1, flash),
          lerp(0.773, 1, flash),
          lerp(0.369, 1, flash)
        );
      }
      if (progress >= 1) {
        stateRef.current.state = "idle";
        if (bodyMatRef.current) bodyMatRef.current.color.set("#22c55e");
      }
    } else if (state === "ko") {
      g.rotation.z = lerp(g.rotation.z, -Math.PI / 2, 0.04);
      g.position.y = lerp(g.position.y, -0.8, 0.05);
    } else if (state === "victory") {
      g.position.y = Math.abs(Math.sin(t * 4)) * 0.5;
      g.rotation.y = lerp(g.rotation.y, g.rotation.y + 0.06, 1);
    }
  });

  return (
    <group ref={groupRef} position={[baseX, 0, 0]}>
      {/* Body */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.15, 1.5, 0.88]} />
        <meshToonMaterial ref={bodyMatRef} color="#22c55e" />
      </mesh>
      {/* Head */}
      <mesh position={[0.3, 1.7, 0]} castShadow>
        <boxGeometry args={[0.85, 0.75, 0.75]} />
        <meshToonMaterial color="#22c55e" />
      </mesh>
      {/* Snout */}
      <mesh position={[0.72, 1.6, 0]}>
        <boxGeometry args={[0.3, 0.28, 0.4]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {/* Left horn */}
      <mesh position={[0.15, 2.15, 0.28]} rotation={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.04, 0.09, 0.55, 6]} />
        <meshToonMaterial color="#d4a017" />
      </mesh>
      {/* Right horn */}
      <mesh position={[0.15, 2.15, -0.28]} rotation={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.04, 0.09, 0.55, 6]} />
        <meshToonMaterial color="#d4a017" />
      </mesh>
      {/* Front-left leg */}
      <mesh position={[0.28, -0.2, 0.3]}>
        <boxGeometry args={[0.24, 0.7, 0.24]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {/* Front-right leg */}
      <mesh position={[0.28, -0.2, -0.3]}>
        <boxGeometry args={[0.24, 0.7, 0.24]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {/* Back-left leg */}
      <mesh position={[-0.28, -0.2, 0.3]}>
        <boxGeometry args={[0.24, 0.7, 0.24]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {/* Back-right leg */}
      <mesh position={[-0.28, -0.2, -0.3]}>
        <boxGeometry args={[0.24, 0.7, 0.24]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {/* Left eye */}
      <mesh position={[0.6, 1.72, 0.2]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.6, 1.72, -0.2]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}

/* ─── Bear Character ─────────────────────────────────────── */

function BearCharacter({ stateRef }: { stateRef: React.RefObject<{ state: CharacterState; timer: number }> }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshToonMaterial>(null);
  const baseX = 2.8;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g || !stateRef.current) return;
    const { state, timer } = stateRef.current;
    const t = clock.elapsedTime;

    if (state === "idle") {
      g.position.x = lerp(g.position.x, baseX, 0.08);
      g.position.y = lerp(g.position.y, Math.sin(t * 1.2 + 1) * 0.06, 0.1);
      g.rotation.z = lerp(g.rotation.z, 0, 0.1);
    } else if (state === "attack") {
      const progress = Math.min(1, (Date.now() / 1000 - timer) / 0.35);
      const punch = Math.sin(progress * Math.PI);
      g.position.x = baseX - punch * 1.2;
      g.position.y = 0;
      if (progress >= 1) stateRef.current.state = "idle";
    } else if (state === "hit") {
      const progress = Math.min(1, (Date.now() / 1000 - timer) / 0.4);
      g.position.x = lerp(g.position.x, baseX + 0.5 * (1 - progress), 0.15);
      if (bodyMatRef.current) {
        const flash = 1 - progress;
        bodyMatRef.current.color.setRGB(
          lerp(0.937, 1, flash),
          lerp(0.267, 1, flash),
          lerp(0.267, 1, flash)
        );
      }
      if (progress >= 1) {
        stateRef.current.state = "idle";
        if (bodyMatRef.current) bodyMatRef.current.color.set("#ef4444");
      }
    } else if (state === "ko") {
      g.rotation.z = lerp(g.rotation.z, Math.PI / 2, 0.04);
      g.position.y = lerp(g.position.y, -0.8, 0.05);
    } else if (state === "victory") {
      g.position.y = Math.abs(Math.sin(t * 4)) * 0.5;
      g.rotation.y = lerp(g.rotation.y, g.rotation.y - 0.06, 1);
    }
  });

  return (
    /* Face toward Bull (negative X = rotate Y PI) */
    <group ref={groupRef} position={[baseX, 0, 0]} rotation={[0, Math.PI, 0]}>
      {/* Body */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[1.3, 1.65, 1.0]} />
        <meshToonMaterial ref={bodyMatRef} color="#ef4444" />
      </mesh>
      {/* Head */}
      <mesh position={[0.35, 1.9, 0]} castShadow>
        <sphereGeometry args={[0.52, 8, 6]} />
        <meshToonMaterial color="#ef4444" />
      </mesh>
      {/* Left ear */}
      <mesh position={[0.15, 2.38, 0.38]}>
        <cylinderGeometry args={[0.14, 0.14, 0.12, 8]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      {/* Right ear */}
      <mesh position={[0.15, 2.38, -0.38]}>
        <cylinderGeometry args={[0.14, 0.14, 0.12, 8]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      {/* Snout */}
      <mesh position={[0.72, 1.82, 0]}>
        <sphereGeometry args={[0.24, 8, 6]} />
        <meshToonMaterial color="#fca5a5" />
      </mesh>
      {/* Front-left leg */}
      <mesh position={[0.35, -0.1, 0.35]}>
        <cylinderGeometry args={[0.2, 0.24, 0.7, 8]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      {/* Front-right leg */}
      <mesh position={[0.35, -0.1, -0.35]}>
        <cylinderGeometry args={[0.2, 0.24, 0.7, 8]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      {/* Back-left leg */}
      <mesh position={[-0.35, -0.1, 0.35]}>
        <cylinderGeometry args={[0.2, 0.24, 0.7, 8]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      {/* Back-right leg */}
      <mesh position={[-0.35, -0.1, -0.35]}>
        <cylinderGeometry args={[0.2, 0.24, 0.7, 8]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      {/* Left eye */}
      <mesh position={[0.72, 1.94, 0.22]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.72, 1.94, -0.22]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}

/* ─── Arena ──────────────────────────────────────────────── */

function Arena() {
  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.56, 0]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#0d1321" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Grid lines on floor */}
      <gridHelper args={[20, 20, "#1e3a5f", "#1e3a5f"]} position={[0, -0.55, 0]} />
      {/* Back wall */}
      <mesh position={[0, 2, -5]} receiveShadow>
        <planeGeometry args={[20, 8]} />
        <meshStandardMaterial color="#080d18" roughness={1} />
      </mesh>
      {/* VS divider line */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.03, 4]} />
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent />
      </mesh>
    </>
  );
}

/* ─── Impact Sparkles ────────────────────────────────────── */

function ImpactEffect({
  position,
  active,
  color,
}: {
  position: [number, number, number];
  active: boolean;
  color: string;
}) {
  if (!active) return null;
  return (
    <Sparkles
      position={position}
      count={30}
      scale={1.5}
      size={4}
      speed={2}
      color={color}
    />
  );
}

/* ─── Camera Shake ───────────────────────────────────────── */

function CameraShake({ shakeRef }: { shakeRef: React.RefObject<{ intensity: number; decay: number }> }) {
  const { camera } = useThree();
  const basePos = useRef(new THREE.Vector3(0, 2.5, 8));

  useFrame(() => {
    if (!shakeRef.current || shakeRef.current.intensity <= 0) {
      camera.position.lerp(basePos.current, 0.1);
      return;
    }
    const { intensity } = shakeRef.current;
    camera.position.x = basePos.current.x + (Math.random() - 0.5) * intensity;
    camera.position.y = basePos.current.y + (Math.random() - 0.5) * intensity;
    shakeRef.current.intensity *= shakeRef.current.decay;
    if (shakeRef.current.intensity < 0.001) shakeRef.current.intensity = 0;
  });

  return null;
}

/* ─── Scene (inner) ──────────────────────────────────────── */

interface SceneProps {
  bullStateRef: React.RefObject<{ state: CharacterState; timer: number }>;
  bearStateRef: React.RefObject<{ state: CharacterState; timer: number }>;
  impactRef: React.RefObject<{ active: boolean; pos: [number, number, number]; color: string }>;
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
}

function Scene({ bullStateRef, bearStateRef, impactRef, shakeRef }: SceneProps) {
  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 8, 5]} intensity={1.3} castShadow />
      <pointLight position={[-5, 3, 2]} color="#22c55e" intensity={0.6} />
      <pointLight position={[5, 3, 2]} color="#ef4444" intensity={0.6} />

      <Arena />
      <BullCharacter stateRef={bullStateRef} />
      <BearCharacter stateRef={bearStateRef} />

      {impactRef.current && (
        <ImpactEffect
          position={impactRef.current.pos}
          active={impactRef.current.active}
          color={impactRef.current.color}
        />
      )}

      <CameraShake shakeRef={shakeRef} />
    </>
  );
}

/* ─── Canvas (exported, dynamically imported) ────────────── */

const BearVsBullCanvas = forwardRef<CanvasHandle>((_, ref) => {
  const bullStateRef = useRef<{ state: CharacterState; timer: number }>({
    state: "idle",
    timer: 0,
  });
  const bearStateRef = useRef<{ state: CharacterState; timer: number }>({
    state: "idle",
    timer: 0,
  });
  const impactRef = useRef<{ active: boolean; pos: [number, number, number]; color: string }>({
    active: false,
    pos: [0, 1, 0],
    color: "#ffffff",
  });
  const shakeRef = useRef<{ intensity: number; decay: number }>({
    intensity: 0,
    decay: 0.85,
  });

  useImperativeHandle(ref, () => ({
    triggerTick(event: TickEvent) {
      const now = Date.now() / 1000;

      if (event.direction === "flat") return;

      if (event.attacker === "bull") {
        bullStateRef.current = { state: "attack", timer: now };
        setTimeout(() => {
          bearStateRef.current = { state: "hit", timer: now + 0.18 };
        }, 180);
      } else {
        bearStateRef.current = { state: "attack", timer: now };
        setTimeout(() => {
          bullStateRef.current = { state: "hit", timer: now + 0.18 };
        }, 180);
      }

      impactRef.current = {
        active: true,
        pos: event.impactPoint,
        color: event.attacker === "bull" ? "#22c55e" : "#ef4444",
      };
      setTimeout(() => {
        impactRef.current = { ...impactRef.current, active: false };
      }, 600);

      if (event.isCritical) {
        shakeRef.current = { intensity: 0.12, decay: 0.82 };
      } else if (event.isCombo) {
        shakeRef.current = { intensity: 0.06, decay: 0.85 };
      }
    },

    triggerKO(loser: "bull" | "bear") {
      const now = Date.now() / 1000;
      if (loser === "bull") {
        bullStateRef.current = { state: "ko", timer: now };
      } else {
        bearStateRef.current = { state: "ko", timer: now };
      }
      shakeRef.current = { intensity: 0.2, decay: 0.88 };
    },

    triggerVictory(winner: "bull" | "bear") {
      const now = Date.now() / 1000;
      if (winner === "bull") {
        bullStateRef.current = { state: "victory", timer: now };
      } else {
        bearStateRef.current = { state: "victory", timer: now };
      }
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 2.5, 8], fov: 55 }}
      shadows
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#080d18");
      }}
    >
      <Scene
        bullStateRef={bullStateRef}
        bearStateRef={bearStateRef}
        impactRef={impactRef}
        shakeRef={shakeRef}
      />
    </Canvas>
  );
});

BearVsBullCanvas.displayName = "BearVsBullCanvas";

export default BearVsBullCanvas;
