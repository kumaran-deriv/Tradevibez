"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export interface DigitOracleCanvasHandle {
  reset(): void;
  triggerSpin(): void;
  triggerReveal(digit: number, isMatch: boolean): void;
  triggerEnd(won: boolean): void;
}

/* ─── Crystal Ball Base ─────────────────────────────────── */

function OrnateBase() {
  return (
    <group position={[0, -1.1, 0]}>
      {/* Main pedestal cylinder */}
      <mesh>
        <cylinderGeometry args={[0.9, 1.1, 0.35, 32]} />
        <meshStandardMaterial
          color="#b8860b"
          metalness={0.85}
          roughness={0.2}
          emissive="#8B6914"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Top rim */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.75, 0.9, 0.12, 32]} />
        <meshStandardMaterial
          color="#daa520"
          metalness={0.9}
          roughness={0.15}
          emissive="#b8860b"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Bottom rim */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[1.1, 1.2, 0.1, 32]} />
        <meshStandardMaterial
          color="#daa520"
          metalness={0.9}
          roughness={0.15}
          emissive="#b8860b"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Decorative ring */}
      <mesh position={[0, 0.0, 0]}>
        <torusGeometry args={[1.0, 0.04, 8, 32]} />
        <meshStandardMaterial
          color="#ffd700"
          metalness={0.95}
          roughness={0.1}
          emissive="#ffd700"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

/* ─── Inner Glow Sphere ─────────────────────────────────── */

function InnerGlow({
  glowRef,
}: {
  glowRef: React.MutableRefObject<{
    color: THREE.Color;
    intensity: number;
    pulseSpeed: number;
  }>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const t = clock.elapsedTime;
    const pulse = 0.5 + Math.sin(t * glowRef.current.pulseSpeed) * 0.3;
    mat.emissive.copy(glowRef.current.color);
    mat.emissiveIntensity = glowRef.current.intensity * pulse;
    mat.color.copy(glowRef.current.color);
    mat.opacity = 0.5 + pulse * 0.3;

    // Gentle float
    meshRef.current.position.y = Math.sin(t * 1.2) * 0.05;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.38, 32, 32]} />
      <meshStandardMaterial
        color="#7c3aed"
        emissive="#7c3aed"
        emissiveIntensity={0.8}
        transparent
        opacity={0.6}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

/* ─── Crystal Ball Outer Sphere ─────────────────────────── */

function CrystalBall({
  ballGlowRef,
}: {
  ballGlowRef: React.MutableRefObject<{ color: string; intensity: number }>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
    mat.emissive.setStyle(ballGlowRef.current.color);
    mat.emissiveIntensity = ballGlowRef.current.intensity;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.85, 64, 64]} />
      <meshPhysicalMaterial
        color="#1a1040"
        transmission={0.6}
        roughness={0.1}
        metalness={0.05}
        clearcoat={1.0}
        clearcoatRoughness={0.05}
        transparent
        opacity={0.35}
        emissive="#4c1d95"
        emissiveIntensity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ─── Digit Text Display ────────────────────────────────── */

function DigitDisplay({
  displayRef,
}: {
  displayRef: React.MutableRefObject<{
    text: string;
    color: string;
    spinning: boolean;
    spinSpeed: number;
    scale: number;
  }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spinDigitRef = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const { spinning, spinSpeed } = displayRef.current;
    const t = clock.elapsedTime;

    if (spinning) {
      // Cycle digits rapidly during spin
      spinDigitRef.current += spinSpeed * 0.016;
      if (spinDigitRef.current >= 1) {
        spinDigitRef.current = 0;
        const rnd = Math.floor(Math.random() * 10);
        displayRef.current.text = String(rnd);
      }
      // Rotate during spin
      groupRef.current.rotation.y = t * 4.0;
    } else {
      // Settle rotation
      groupRef.current.rotation.y *= 0.92;
    }

    // Pulse scale
    const baseScale = displayRef.current.scale;
    const pulse = 1.0 + Math.sin(t * 2.0) * 0.05;
    groupRef.current.scale.setScalar(baseScale * pulse);
  });

  return (
    <group ref={groupRef}>
      <Text
        position={[0, 0, 0]}
        fontSize={0.55}
        color={displayRef.current.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#000000"
        font={undefined}
      >
        {displayRef.current.text}
        <meshStandardMaterial
          color={displayRef.current.color}
          emissive={displayRef.current.color}
          emissiveIntensity={1.2}
        />
      </Text>
    </group>
  );
}

/* ─── Score Gems (orbiting spheres for hits) ────────────── */

function ScoreGems({
  gemsRef,
}: {
  gemsRef: React.MutableRefObject<{ count: number }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const count = gemsRef.current.count;

    for (let i = 0; i < 10; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      if (i < count) {
        mesh.visible = true;
        const angle = (i / Math.max(count, 1)) * Math.PI * 2 + t * 0.8;
        const radius = 1.3;
        mesh.position.x = Math.cos(angle) * radius;
        mesh.position.z = Math.sin(angle) * radius;
        mesh.position.y = 0.3 + Math.sin(t * 2 + i) * 0.15;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.6 + Math.sin(t * 3 + i * 0.5) * 0.3;
      } else {
        mesh.visible = false;
      }
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={0.6}
            metalness={0.4}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Burst Effect (match/miss visual) ──────────────────── */

function BurstEffect({
  burstRef,
}: {
  burstRef: React.MutableRefObject<{
    active: boolean;
    t: number;
    type: "match" | "miss" | "none";
  }>;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const b = burstRef.current;

    if (!b.active) {
      if (ringRef.current) ringRef.current.visible = false;
      if (flashRef.current) flashRef.current.intensity = 0;
      return;
    }

    b.t += delta;
    const duration = b.type === "match" ? 0.8 : 0.5;
    const progress = Math.min(b.t / duration, 1);

    if (ringRef.current) {
      ringRef.current.visible = true;
      const sc = 0.3 + progress * 3.5;
      ringRef.current.scale.set(sc, sc, sc);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.9;
      mat.color.setStyle(b.type === "match" ? "#ffd700" : "#ef4444");
    }

    if (flashRef.current) {
      const flashColor = b.type === "match" ? "#ffd700" : "#ef4444";
      flashRef.current.color.setStyle(flashColor);
      flashRef.current.intensity = (1 - progress) * (b.type === "match" ? 80 : 30);
    }

    if (progress >= 1) {
      b.active = false;
    }
  });

  return (
    <>
      <mesh ref={ringRef} visible={false}>
        <ringGeometry args={[0.5, 0.7, 48]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={flashRef}
        position={[0, 0.5, 1]}
        intensity={0}
        distance={8}
        decay={2}
      />
    </>
  );
}

/* ─── End Effect (win/loss) ─────────────────────────────── */

function EndEffect({
  endRef,
}: {
  endRef: React.MutableRefObject<{ active: boolean; won: boolean; t: number }>;
}) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    if (!lightRef.current) return;
    const e = endRef.current;

    if (!e.active) {
      lightRef.current.intensity = 0;
      return;
    }

    e.t += delta;
    const progress = Math.min(e.t / 2.0, 1);

    if (e.won) {
      lightRef.current.color.setStyle("#ffd700");
      lightRef.current.intensity = Math.sin(progress * Math.PI) * 120;
    } else {
      lightRef.current.color.setStyle("#ef4444");
      lightRef.current.intensity = Math.sin(progress * Math.PI) * 40;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 1, 2]}
      intensity={0}
      distance={12}
      decay={2}
    />
  );
}

/* ─── Scene ──────────────────────────────────────────────── */

interface SceneProps {
  glowRef: React.MutableRefObject<{
    color: THREE.Color;
    intensity: number;
    pulseSpeed: number;
  }>;
  ballGlowRef: React.MutableRefObject<{ color: string; intensity: number }>;
  displayRef: React.MutableRefObject<{
    text: string;
    color: string;
    spinning: boolean;
    spinSpeed: number;
    scale: number;
  }>;
  gemsRef: React.MutableRefObject<{ count: number }>;
  burstRef: React.MutableRefObject<{
    active: boolean;
    t: number;
    type: "match" | "miss" | "none";
  }>;
  endRef: React.MutableRefObject<{ active: boolean; won: boolean; t: number }>;
  winSparklesRef: React.MutableRefObject<boolean>;
  matchSparklesRef: React.MutableRefObject<boolean>;
}

function Scene({
  glowRef,
  ballGlowRef,
  displayRef,
  gemsRef,
  burstRef,
  endRef,
  winSparklesRef,
  matchSparklesRef,
}: SceneProps) {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.8} />
      <hemisphereLight args={["#4a3a8a", "#0a0520", 1.2]} />

      {/* Main overhead */}
      <directionalLight position={[0, 6, 4]} intensity={2.5} />

      {/* Purple mystical lights */}
      <pointLight position={[-2, 3, 2]} color="#7c3aed" intensity={40} distance={10} decay={2} />
      <pointLight position={[2, 3, 2]} color="#6d28d9" intensity={40} distance={10} decay={2} />
      <pointLight position={[0, 4, -1]} color="#a855f7" intensity={30} distance={8} decay={2} />

      {/* Indigo accent from below */}
      <pointLight position={[0, -1.5, 1]} color="#4338ca" intensity={20} distance={6} decay={2} />

      {/* Crystal ball group */}
      <group position={[0, 0.3, 0]}>
        <CrystalBall ballGlowRef={ballGlowRef} />
        <InnerGlow glowRef={glowRef} />
        <DigitDisplay displayRef={displayRef} />
        <BurstEffect burstRef={burstRef} />

        {/* Ambient sparkles around ball */}
        <Sparkles
          count={40}
          scale={2.5}
          size={3}
          speed={0.4}
          color="#a855f7"
        />

        {/* Match sparkles — golden burst */}
        <MatchSparklesController activeRef={matchSparklesRef} />

        {/* Win sparkles — lots of gold */}
        <WinSparklesController activeRef={winSparklesRef} />
      </group>

      {/* Score gems */}
      <group position={[0, 0.3, 0]}>
        <ScoreGems gemsRef={gemsRef} />
      </group>

      {/* Base */}
      <OrnateBase />

      {/* End effect */}
      <EndEffect endRef={endRef} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color="#0a0520" roughness={0.9} />
      </mesh>

      {/* Backwall */}
      <mesh position={[0, 2, -5]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#080318" roughness={0.95} />
      </mesh>
    </>
  );
}

/* ─── Sparkle controllers ────────────────────────────────── */

function MatchSparklesController({
  activeRef,
}: {
  activeRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = activeRef.current;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <Sparkles count={60} scale={2.0} size={6} speed={3} color="#ffd700" />
    </group>
  );
}

function WinSparklesController({
  activeRef,
}: {
  activeRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = activeRef.current;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <Sparkles count={100} scale={3.5} size={8} speed={4} color="#ffd700" />
      <Sparkles count={40} scale={2.5} size={5} speed={3} color="#f59e0b" />
    </group>
  );
}

/* ─── Canvas (exported) ──────────────────────────────────── */

const DigitOracleCanvas = forwardRef<DigitOracleCanvasHandle>((_, ref) => {
  const glowRef = useRef({
    color: new THREE.Color("#7c3aed"),
    intensity: 0.8,
    pulseSpeed: 2.0,
  });

  const ballGlowRef = useRef({ color: "#4c1d95", intensity: 0.15 });

  const displayRef = useRef({
    text: "?",
    color: "#a855f7",
    spinning: false,
    spinSpeed: 12,
    scale: 1.0,
  });

  const gemsRef = useRef({ count: 0 });

  const burstRef = useRef<{
    active: boolean;
    t: number;
    type: "match" | "miss" | "none";
  }>({
    active: false,
    t: 0,
    type: "none",
  });

  const endRef = useRef({ active: false, won: false, t: 0 });
  const winSparklesRef = useRef(false);
  const matchSparklesRef = useRef(false);

  useImperativeHandle(ref, () => ({
    reset() {
      displayRef.current = {
        text: "?",
        color: "#a855f7",
        spinning: false,
        spinSpeed: 12,
        scale: 1.0,
      };
      glowRef.current = {
        color: new THREE.Color("#7c3aed"),
        intensity: 0.8,
        pulseSpeed: 2.0,
      };
      ballGlowRef.current = { color: "#4c1d95", intensity: 0.15 };
      gemsRef.current = { count: 0 };
      burstRef.current = { active: false, t: 0, type: "none" };
      endRef.current = { active: false, won: false, t: 0 };
      winSparklesRef.current = false;
      matchSparklesRef.current = false;
    },

    triggerSpin() {
      displayRef.current.spinning = true;
      displayRef.current.spinSpeed = 12;
      displayRef.current.color = "#c4b5fd";
      glowRef.current.pulseSpeed = 6.0;
      glowRef.current.intensity = 1.5;
      glowRef.current.color.setStyle("#8b5cf6");
      ballGlowRef.current = { color: "#7c3aed", intensity: 0.4 };
      matchSparklesRef.current = false;
    },

    triggerReveal(digit: number, isMatch: boolean) {
      displayRef.current.spinning = false;
      displayRef.current.text = String(digit);
      displayRef.current.scale = 1.2;

      if (isMatch) {
        displayRef.current.color = "#ffd700";
        glowRef.current.color.setStyle("#ffd700");
        glowRef.current.intensity = 2.5;
        glowRef.current.pulseSpeed = 4.0;
        ballGlowRef.current = { color: "#ffd700", intensity: 0.6 };
        burstRef.current = { active: true, t: 0, type: "match" };
        matchSparklesRef.current = true;
        gemsRef.current = { count: gemsRef.current.count + 1 };

        // Clear match sparkles after a bit
        setTimeout(() => {
          matchSparklesRef.current = false;
        }, 1200);
      } else {
        displayRef.current.color = "#ef4444";
        glowRef.current.color.setStyle("#6b21a8");
        glowRef.current.intensity = 0.5;
        glowRef.current.pulseSpeed = 1.5;
        ballGlowRef.current = { color: "#991b1b", intensity: 0.3 };
        burstRef.current = { active: true, t: 0, type: "miss" };
      }

      // Settle display back to purple after reveal
      setTimeout(() => {
        displayRef.current.scale = 1.0;
        glowRef.current.color.setStyle("#7c3aed");
        glowRef.current.intensity = 0.8;
        glowRef.current.pulseSpeed = 2.0;
        ballGlowRef.current = { color: "#4c1d95", intensity: 0.15 };
      }, 1400);
    },

    triggerEnd(won: boolean) {
      endRef.current = { active: true, won, t: 0 };

      if (won) {
        displayRef.current.color = "#ffd700";
        glowRef.current.color.setStyle("#ffd700");
        glowRef.current.intensity = 3.0;
        ballGlowRef.current = { color: "#ffd700", intensity: 0.8 };
        winSparklesRef.current = true;
      } else {
        displayRef.current.color = "#6b7280";
        glowRef.current.color.setStyle("#374151");
        glowRef.current.intensity = 0.3;
        ballGlowRef.current = { color: "#1f2937", intensity: 0.1 };
      }
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 1.0, 4.0], fov: 48 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0a0520");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
    >
      <Scene
        glowRef={glowRef}
        ballGlowRef={ballGlowRef}
        displayRef={displayRef}
        gemsRef={gemsRef}
        burstRef={burstRef}
        endRef={endRef}
        winSparklesRef={winSparklesRef}
        matchSparklesRef={matchSparklesRef}
      />
    </Canvas>
  );
});

DigitOracleCanvas.displayName = "DigitOracleCanvas";

export default DigitOracleCanvas;
