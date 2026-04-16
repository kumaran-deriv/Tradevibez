"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export interface GrandPrixCanvasHandle {
  reset(): void;
  triggerTick(dir: "up" | "down", goldZ: number, purpleZ: number): void;
  triggerFinish(winner: "gold" | "purple"): void;
}

/* ─── Race Track — fiery fantasy theme ───────────────────── */

function RaceTrack() {
  return (
    <>
      {/* Base lava floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 6]} receiveShadow>
        <planeGeometry args={[10, 18]} />
        <meshStandardMaterial color="#1a0a05" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Gold lane surface */}
      <mesh position={[-1.4, -0.29, 6]}>
        <boxGeometry args={[2.5, 0.04, 15]} />
        <meshStandardMaterial
          color="#2a1a0a"
          emissive="#f59e0b"
          emissiveIntensity={0.05}
          roughness={0.75}
        />
      </mesh>

      {/* Purple lane surface */}
      <mesh position={[1.4, -0.29, 6]}>
        <boxGeometry args={[2.5, 0.04, 15]} />
        <meshStandardMaterial
          color="#1a0a2a"
          emissive="#a855f7"
          emissiveIntensity={0.05}
          roughness={0.75}
        />
      </mesh>

      {/* Center lava divider */}
      <mesh position={[0, -0.24, 6]}>
        <boxGeometry args={[0.1, 0.08, 15]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Gold lane glowing dashes */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={`gd-${i}`} position={[-1.4, -0.24, i * 1.2 + 0.3]}>
          <boxGeometry args={[0.08, 0.03, 0.55]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Purple lane glowing dashes */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={`pd-${i}`} position={[1.4, -0.24, i * 1.2 + 0.3]}>
          <boxGeometry args={[0.08, 0.03, 0.55]} />
          <meshStandardMaterial
            color="#a855f7"
            emissive="#a855f7"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Outer lava glow strips */}
      <mesh position={[-3.2, -0.28, 6]}>
        <boxGeometry args={[0.3, 0.04, 15]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[3.2, -0.28, 6]}>
        <boxGeometry args={[0.3, 0.04, 15]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={0.4} />
      </mesh>

      {/* Start line */}
      <mesh position={[0, -0.25, 0.05]}>
        <boxGeometry args={[5.2, 0.03, 0.15]} />
        <meshStandardMaterial color="#94a3b8" emissive="#94a3b8" emissiveIntensity={0.3} />
      </mesh>

      {/* Finish line — golden glow */}
      <mesh position={[0, -0.25, 13]}>
        <boxGeometry args={[5.2, 0.04, 0.2]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2.0} />
      </mesh>

      {/* Finish gate posts */}
      <mesh position={[-2.8, 0.6, 13]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 2.0, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[2.8, 0.6, 13]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 2.0, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Finish gate crossbar */}
      <mesh position={[0, 1.6, 13]}>
        <boxGeometry args={[5.7, 0.14, 0.14]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.0} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Grid overlay */}
      <gridHelper args={[10, 20, "#2a1008", "#1a0805"]} position={[0, -0.27, 6]} />

      {/* Ambient lava particles along edges */}
      <group position={[-3.2, 0.2, 6]}>
        <Sparkles count={30} scale={[0.6, 1.5, 14]} size={4} speed={1.5} color="#ff4500" />
      </group>
      <group position={[3.2, 0.2, 6]}>
        <Sparkles count={30} scale={[0.6, 1.5, 14]} size={4} speed={1.5} color="#ff4500" />
      </group>
    </>
  );
}

/* ─── Procedural Race Car ──────────────────────────────────── */

interface RaceCarProps {
  xLane: number;
  bodyColor: string;
  emissiveColor: string;
  zRef: React.RefObject<number>;
  sparkRef: React.RefObject<boolean>;
}

function RaceCar({ xLane, bodyColor, emissiveColor, zRef, sparkRef }: RaceCarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const wheelFLRef = useRef<THREE.Mesh>(null);
  const wheelFRRef = useRef<THREE.Mesh>(null);
  const wheelBLRef = useRef<THREE.Mesh>(null);
  const wheelBRRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const targetZ = zRef.current ?? 0;
    const currentZ = groupRef.current.position.z;
    const dist = Math.abs(targetZ - currentZ);
    const speed = dist > 1.5 ? 0.18 : 0.1;
    groupRef.current.position.z = THREE.MathUtils.lerp(currentZ, targetZ, speed);

    // Subtle suspension bounce
    groupRef.current.position.y = -0.1 + Math.sin(clock.elapsedTime * 8 + xLane * 3) * 0.015;

    // Slight body roll
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 5 + xLane) * 0.02;

    // Spin wheels based on movement
    const wheelSpin = clock.elapsedTime * 12;
    [wheelFLRef, wheelFRRef, wheelBLRef, wheelBRRef].forEach((w) => {
      if (w.current) w.current.rotation.x = wheelSpin;
    });

    if (sparkGroupRef.current) {
      sparkGroupRef.current.visible = sparkRef.current ?? false;
    }
  });

  return (
    <group ref={groupRef} position={[xLane, -0.1, 0]}>
      {/* Main chassis */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.55, 0.12, 1.0]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={emissiveColor}
          emissiveIntensity={0.3}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Cabin / cockpit */}
      <mesh position={[0, 0.22, -0.05]} castShadow>
        <boxGeometry args={[0.32, 0.1, 0.35]} />
        <meshStandardMaterial
          color="#111111"
          emissive={emissiveColor}
          emissiveIntensity={0.1}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Nose cone */}
      <mesh position={[0, 0.1, 0.6]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.15, 0.35, 8]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={emissiveColor}
          emissiveIntensity={0.4}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Rear spoiler - wing */}
      <mesh position={[0, 0.28, -0.48]}>
        <boxGeometry args={[0.6, 0.04, 0.08]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={emissiveColor}
          emissiveIntensity={0.5}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Spoiler pillars */}
      <mesh position={[-0.18, 0.22, -0.48]}>
        <boxGeometry args={[0.03, 0.1, 0.03]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.18, 0.22, -0.48]}>
        <boxGeometry args={[0.03, 0.1, 0.03]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Front left wheel */}
      <mesh ref={wheelFLRef} position={[-0.32, 0.04, 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Front right wheel */}
      <mesh ref={wheelFRRef} position={[0.32, 0.04, 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Back left wheel */}
      <mesh ref={wheelBLRef} position={[-0.32, 0.04, -0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Back right wheel */}
      <mesh ref={wheelBRRef} position={[0.32, 0.04, -0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Exhaust glow */}
      <mesh position={[-0.12, 0.08, -0.52]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.12, 0.08, -0.52]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={2} />
      </mesh>

      {/* Surge spark effect */}
      <group ref={sparkGroupRef} visible={false} position={[0, 0.2, -0.7]}>
        <Sparkles count={40} scale={[0.5, 0.3, 0.4]} size={7} speed={4.5} color={emissiveColor} />
      </group>
    </group>
  );
}

/* ─── Finish Explosion ───────────────────────────────────── */

function FinishExplosion({
  finishRef,
}: {
  finishRef: React.RefObject<{ active: boolean; x: number }>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = finishRef.current.active;
      groupRef.current.position.x = finishRef.current.x;
    }
  });

  return (
    <group ref={groupRef} visible={false} position={[0, 1.0, 13]}>
      <Sparkles count={200} scale={7} size={18} speed={8} color="#f59e0b" />
      <Sparkles count={80} scale={5} size={12} speed={6} color="#ff4500" />
    </group>
  );
}

/* ─── Camera Controller ─────────────────────────────────── */

function CameraController({
  shakeRef,
  goldZRef,
  purpleZRef,
}: {
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
  goldZRef: React.RefObject<number>;
  purpleZRef: React.RefObject<number>;
}) {
  const { camera } = useThree();

  useFrame(() => {
    const avgZ = ((goldZRef.current ?? 0) + (purpleZRef.current ?? 0)) / 2;
    const baseX = 0;
    const baseY = 6.5;
    const baseZ = avgZ - 4.5;

    if (!shakeRef.current || shakeRef.current.intensity <= 0) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, baseX, 0.06);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, baseY, 0.06);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseZ, 0.06);
    } else {
      const { intensity } = shakeRef.current;
      camera.position.x = baseX + (Math.random() - 0.5) * intensity;
      camera.position.y = baseY + (Math.random() - 0.5) * intensity;
      camera.position.z = baseZ;
      shakeRef.current.intensity *= shakeRef.current.decay;
      if (shakeRef.current.intensity < 0.001) shakeRef.current.intensity = 0;
    }

    camera.lookAt(0, 0, avgZ + 3);
  });

  return null;
}

/* ─── Scene ──────────────────────────────────────────────── */

interface SceneProps {
  goldZRef: React.RefObject<number>;
  purpleZRef: React.RefObject<number>;
  goldSparkRef: React.RefObject<boolean>;
  purpleSparkRef: React.RefObject<boolean>;
  finishRef: React.RefObject<{ active: boolean; x: number }>;
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
}

function Scene({
  goldZRef, purpleZRef, goldSparkRef, purpleSparkRef, finishRef, shakeRef,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.8} />
      <hemisphereLight args={["#ff6b35", "#1a0a05", 0.8]} />
      <directionalLight position={[2, 10, 5]} intensity={2.5} castShadow />
      <pointLight position={[-1.4, 4, 6]} color="#f59e0b" intensity={60} distance={16} decay={2} />
      <pointLight position={[1.4, 4, 6]} color="#a855f7" intensity={60} distance={16} decay={2} />
      <pointLight position={[0, -1, 6]} color="#ff4500" intensity={20} distance={14} decay={2} />
      <pointLight position={[0, 3, 13]} color="#f59e0b" intensity={40} distance={12} decay={2} />
      <pointLight position={[0, 5, 16]} color="#ef4444" intensity={15} distance={14} decay={2} />

      <RaceTrack />

      <RaceCar
        xLane={-1.4}
        bodyColor="#b45309"
        emissiveColor="#f59e0b"
        zRef={goldZRef}
        sparkRef={goldSparkRef}
      />

      <RaceCar
        xLane={1.4}
        bodyColor="#7e22ce"
        emissiveColor="#a855f7"
        zRef={purpleZRef}
        sparkRef={purpleSparkRef}
      />

      <FinishExplosion finishRef={finishRef} />
      <CameraController shakeRef={shakeRef} goldZRef={goldZRef} purpleZRef={purpleZRef} />
    </>
  );
}

/* ─── Canvas ─────────────────────────────────────────────── */

const GrandPrixCanvas = forwardRef<GrandPrixCanvasHandle>((_, ref) => {
  const goldZRef       = useRef<number>(0);
  const purpleZRef     = useRef<number>(0);
  const goldSparkRef   = useRef<boolean>(false);
  const purpleSparkRef = useRef<boolean>(false);
  const finishRef      = useRef<{ active: boolean; x: number }>({ active: false, x: 0 });
  const shakeRef       = useRef<{ intensity: number; decay: number }>({ intensity: 0, decay: 0.84 });

  useImperativeHandle(ref, () => ({
    reset() {
      goldZRef.current = 0;
      purpleZRef.current = 0;
      goldSparkRef.current = false;
      purpleSparkRef.current = false;
      finishRef.current = { active: false, x: 0 };
      shakeRef.current = { intensity: 0, decay: 0.84 };
    },

    triggerTick(dir: "up" | "down", goldZ: number, purpleZ: number) {
      goldZRef.current = goldZ;
      purpleZRef.current = purpleZ;
      if (dir === "up") {
        goldSparkRef.current = true;
        setTimeout(() => { goldSparkRef.current = false; }, 350);
      } else {
        purpleSparkRef.current = true;
        setTimeout(() => { purpleSparkRef.current = false; }, 350);
      }
    },

    triggerFinish(winner: "gold" | "purple") {
      finishRef.current = { active: true, x: winner === "gold" ? -1.4 : 1.4 };
      setTimeout(() => { finishRef.current.active = false; }, 2500);
      shakeRef.current = { intensity: 0.5, decay: 0.84 };
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 6.5, -4.5], fov: 56 }}
      shadows
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor("#0a0205");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        (camera as THREE.PerspectiveCamera).lookAt(0, 0, 3);
      }}
    >
      <Scene
        goldZRef={goldZRef}
        purpleZRef={purpleZRef}
        goldSparkRef={goldSparkRef}
        purpleSparkRef={purpleSparkRef}
        finishRef={finishRef}
        shakeRef={shakeRef}
      />
    </Canvas>
  );
});

GrandPrixCanvas.displayName = "GrandPrixCanvas";

export default GrandPrixCanvas;
