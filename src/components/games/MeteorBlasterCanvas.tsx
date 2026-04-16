"use client";

import { useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export interface PressureCanvasHandle {
  reset(accentColor: string): void;
  triggerTick(tickIndex: number, totalTicks: number): void;
  triggerSpike(direction: "crash" | "boom"): void;
  triggerDefusal(): void;
}

/* ─── Starfield ──────────────────────────────────────────── */

function Starfield() {
  const positions = useMemo(() => {
    const pos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = -10 - Math.random() * 35;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.06} sizeAttenuation />
    </points>
  );
}

/* ─── Pressure Chamber (glass cylinder + caps + struts) ──── */

function PressureChamber() {
  return (
    <group>
      {/* Glass cylinder */}
      <mesh>
        <cylinderGeometry args={[1.2, 1.2, 5, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#1a2a40"
          transparent
          opacity={0.12}
          roughness={0.1}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top cap */}
      <mesh position={[0, 2.55, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 0.12, 32]} />
        <meshStandardMaterial color="#2a3a50" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Bottom cap */}
      <mesh position={[0, -2.55, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 0.12, 32]} />
        <meshStandardMaterial color="#2a3a50" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* 4 vertical struts */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 1.22, 0, Math.sin(angle) * 1.22]}
        >
          <boxGeometry args={[0.06, 5.1, 0.06]} />
          <meshStandardMaterial color="#3a4a60" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Energy Core ────────────────────────────────────────── */

function EnergyCore({
  accentRef,
  intensityRef,
  scaleRef,
  coreYRef,
}: {
  accentRef: React.RefObject<THREE.Color>;
  intensityRef: React.RefObject<number>;
  scaleRef: React.RefObject<number>;
  coreYRef: React.RefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const basePulse = Math.sin(clock.elapsedTime * 3.5) * 0.15 + 1;
      const s = (scaleRef.current ?? 1) * basePulse;
      meshRef.current.scale.setScalar(s);
      meshRef.current.position.y = coreYRef.current ?? 0;
      meshRef.current.rotation.y = clock.elapsedTime * 1.2;
    }
    if (matRef.current && accentRef.current) {
      matRef.current.color.copy(accentRef.current);
      matRef.current.emissive.copy(accentRef.current);
      matRef.current.emissiveIntensity = intensityRef.current ?? 1.5;
    }
    if (glowRef.current) {
      glowRef.current.position.y = coreYRef.current ?? 0;
      const gs = (scaleRef.current ?? 1) * 2.5;
      glowRef.current.scale.setScalar(gs);
    }
  });

  return (
    <>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={1.5}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
    </>
  );
}

/* ─── Pressure Rings (3 horizontal) ──────────────────────── */

function PressureRings({
  accentRef,
  litCountRef,
}: {
  accentRef: React.RefObject<THREE.Color>;
  litCountRef: React.RefObject<number>;
}) {
  const ringRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const matRefs = [
    useRef<THREE.MeshStandardMaterial>(null),
    useRef<THREE.MeshStandardMaterial>(null),
    useRef<THREE.MeshStandardMaterial>(null),
  ];

  useFrame(({ clock }) => {
    const lit = litCountRef.current ?? 0;
    for (let i = 0; i < 3; i++) {
      const mesh = ringRefs[i].current;
      const mat = matRefs[i].current;
      if (!mesh || !mat || !accentRef.current) continue;

      mesh.rotation.z = clock.elapsedTime * (0.5 + i * 0.3);
      const isLit = i < lit;
      if (isLit) {
        mat.color.copy(accentRef.current);
        mat.emissive.copy(accentRef.current);
        const pulse = Math.sin(clock.elapsedTime * 2.5 + i * 1.5) * 0.3 + 0.7;
        mat.emissiveIntensity = 0.6 * pulse;
        mat.opacity = 0.85;
      } else {
        mat.color.set("#1a2a40");
        mat.emissive.set("#1a2a40");
        mat.emissiveIntensity = 0.05;
        mat.opacity = 0.2;
      }
    }
  });

  const yPositions = [-1.5, 0, 1.5];

  return (
    <>
      {yPositions.map((y, i) => (
        <mesh key={i} ref={ringRefs[i]} position={[0, y, 0]}>
          <torusGeometry args={[1.5, 0.045, 12, 64]} />
          <meshStandardMaterial
            ref={matRefs[i]}
            color="#1a2a40"
            emissive="#1a2a40"
            emissiveIntensity={0.05}
            transparent
            opacity={0.2}
          />
        </mesh>
      ))}
    </>
  );
}

/* ─── Pressure Fill (rising cylinder inside chamber) ─────── */

function PressureFill({
  fillPctRef,
  accentRef,
}: {
  fillPctRef: React.RefObject<number>;
  accentRef: React.RefObject<THREE.Color>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const pct = fillPctRef.current ?? 0;
    const maxH = 4.8;
    const h = Math.max(0.01, pct * maxH);
    meshRef.current.scale.y = h;
    meshRef.current.position.y = -2.4 + h / 2;
    if (accentRef.current) {
      matRef.current.color.copy(accentRef.current);
      matRef.current.emissive.copy(accentRef.current);
    }
    matRef.current.opacity = 0.08 + pct * 0.15;
  });

  return (
    <mesh ref={meshRef} scale={[1, 0.01, 1]}>
      <cylinderGeometry args={[1.1, 1.1, 1, 24]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ef4444"
        emissive="#ef4444"
        emissiveIntensity={0.3}
        transparent
        opacity={0.08}
      />
    </mesh>
  );
}

/* ─── Explosion Sparkles ─────────────────────────────────── */

function ExplosionEffect({
  activeRef,
  dirRef,
  accentRef,
}: {
  activeRef: React.RefObject<boolean>;
  dirRef: React.RefObject<"crash" | "boom" | null>;
  accentRef: React.RefObject<THREE.Color>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = activeRef.current ?? false;
      const dir = dirRef.current;
      groupRef.current.position.y = dir === "crash" ? -1.5 : dir === "boom" ? 1.5 : 0;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <Sparkles count={200} scale={8} size={16} speed={8} color="#ef4444" />
      <Sparkles count={100} scale={5} size={10} speed={6} color="#ffffff" />
    </group>
  );
}

/* ─── Camera Controller (slow orbit + shake) ─────────────── */

function CameraController({
  shakeRef,
}: {
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
}) {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.15;
    const baseX = Math.sin(t) * 2;
    const baseZ = 9 + Math.cos(t) * 1.5;
    const baseY = 0.5;

    if (!shakeRef.current || shakeRef.current.intensity <= 0) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, baseX, 0.04);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, baseY, 0.04);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseZ, 0.04);
    } else {
      const { intensity } = shakeRef.current;
      camera.position.x = baseX + (Math.random() - 0.5) * intensity;
      camera.position.y = baseY + (Math.random() - 0.5) * intensity;
      camera.position.z = baseZ;
      shakeRef.current.intensity *= shakeRef.current.decay;
      if (shakeRef.current.intensity < 0.001) shakeRef.current.intensity = 0;
    }
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ─── Scene ──────────────────────────────────────────────── */

interface SceneProps {
  accentRef: React.RefObject<THREE.Color>;
  coreIntensityRef: React.RefObject<number>;
  coreScaleRef: React.RefObject<number>;
  coreYRef: React.RefObject<number>;
  litCountRef: React.RefObject<number>;
  fillPctRef: React.RefObject<number>;
  explosionActiveRef: React.RefObject<boolean>;
  explosionDirRef: React.RefObject<"crash" | "boom" | null>;
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
  sparkSpeedRef: React.RefObject<number>;
}

function Scene({
  accentRef, coreIntensityRef, coreScaleRef, coreYRef,
  litCountRef, fillPctRef, explosionActiveRef, explosionDirRef,
  shakeRef, sparkSpeedRef,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 0, 5]} color="#ef4444" intensity={3} distance={20} decay={2} />
      <pointLight position={[0, 4, 3]} color="#ffffff" intensity={0.5} distance={18} decay={2} />
      <pointLight position={[0, -4, 3]} color="#ef4444" intensity={1} distance={16} decay={2} />
      <pointLight position={[3, 0, 3]} color="#a855f7" intensity={0.6} distance={16} decay={2} />

      <Starfield />
      <PressureChamber />
      <EnergyCore
        accentRef={accentRef}
        intensityRef={coreIntensityRef}
        scaleRef={coreScaleRef}
        coreYRef={coreYRef}
      />
      <PressureRings accentRef={accentRef} litCountRef={litCountRef} />
      <PressureFill fillPctRef={fillPctRef} accentRef={accentRef} />
      <ExplosionEffect
        activeRef={explosionActiveRef}
        dirRef={explosionDirRef}
        accentRef={accentRef}
      />

      {/* Warning particles inside chamber */}
      <group position={[0, 0, 0]}>
        <Sparkles count={50} scale={[2, 4.5, 2]} size={3} speed={1.5} color="#ef4444" />
      </group>

      <CameraController shakeRef={shakeRef} />
    </>
  );
}

/* ─── Canvas ─────────────────────────────────────────────── */

const MeteorBlasterCanvas = forwardRef<PressureCanvasHandle>((_, ref) => {
  const accentRef = useRef<THREE.Color>(new THREE.Color("#ef4444"));
  const coreIntensityRef = useRef<number>(1.5);
  const coreScaleRef = useRef<number>(1);
  const coreYRef = useRef<number>(0);
  const litCountRef = useRef<number>(0);
  const fillPctRef = useRef<number>(0);
  const explosionActiveRef = useRef<boolean>(false);
  const explosionDirRef = useRef<"crash" | "boom" | null>(null);
  const shakeRef = useRef<{ intensity: number; decay: number }>({ intensity: 0, decay: 0.84 });
  const sparkSpeedRef = useRef<number>(1.5);

  useImperativeHandle(ref, () => ({
    reset(accentColor: string) {
      accentRef.current.set(accentColor);
      coreIntensityRef.current = 1.5;
      coreScaleRef.current = 1;
      coreYRef.current = 0;
      litCountRef.current = 0;
      fillPctRef.current = 0;
      explosionActiveRef.current = false;
      explosionDirRef.current = null;
      shakeRef.current = { intensity: 0, decay: 0.84 };
      sparkSpeedRef.current = 1.5;
    },

    triggerTick(tickIndex: number, totalTicks: number) {
      const pct = tickIndex / totalTicks;
      fillPctRef.current = pct;

      // Light up rings at thresholds
      if (pct >= 0.33) litCountRef.current = Math.max(litCountRef.current, 1);
      if (pct >= 0.66) litCountRef.current = Math.max(litCountRef.current, 2);
      if (pct >= 1.0)  litCountRef.current = 3;

      // Core intensity rises with pressure
      coreIntensityRef.current = 1.5 + pct * 3;
      sparkSpeedRef.current = 1.5 + pct * 4;

      // Tick flash: brief intensity spike
      const prev = coreIntensityRef.current;
      coreIntensityRef.current = prev + 2;
      setTimeout(() => { coreIntensityRef.current = prev; }, 200);

      // Micro camera shake that intensifies
      shakeRef.current = { intensity: 0.01 + pct * 0.06, decay: 0.88 };

      // Pressure lurch — core scale briefly spikes
      coreScaleRef.current = 1 + pct * 0.3;
      const baseScale = coreScaleRef.current;
      coreScaleRef.current = baseScale * 1.3;
      setTimeout(() => { coreScaleRef.current = baseScale; }, 180);
    },

    triggerSpike(direction: "crash" | "boom") {
      explosionDirRef.current = direction;
      explosionActiveRef.current = true;
      coreIntensityRef.current = 10;
      coreScaleRef.current = 4;
      coreYRef.current = direction === "crash" ? -2 : 2;
      shakeRef.current = { intensity: 0.8, decay: 0.78 };

      setTimeout(() => {
        explosionActiveRef.current = false;
        coreIntensityRef.current = 2;
        coreScaleRef.current = 1.5;
      }, 2500);
    },

    triggerDefusal() {
      // Slowly drain pressure
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        setTimeout(() => {
          fillPctRef.current = Math.max(0, fillPctRef.current - 1 / steps);
          litCountRef.current = Math.max(0, Math.floor(fillPctRef.current * 3));
          coreIntensityRef.current = Math.max(0.5, coreIntensityRef.current - 0.4);
          coreScaleRef.current = Math.max(0.6, coreScaleRef.current - 0.05);
        }, i * 180);
      }
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 0.5, 9], fov: 52 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#020408");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
    >
      <Scene
        accentRef={accentRef}
        coreIntensityRef={coreIntensityRef}
        coreScaleRef={coreScaleRef}
        coreYRef={coreYRef}
        litCountRef={litCountRef}
        fillPctRef={fillPctRef}
        explosionActiveRef={explosionActiveRef}
        explosionDirRef={explosionDirRef}
        shakeRef={shakeRef}
        sparkSpeedRef={sparkSpeedRef}
      />
    </Canvas>
  );
});

MeteorBlasterCanvas.displayName = "MeteorBlasterCanvas";

export default MeteorBlasterCanvas;
