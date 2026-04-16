"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export interface DragonRaceCanvasHandle {
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

      {/* Gold lane surface — warm stone */}
      <mesh position={[-1.4, -0.29, 6]}>
        <boxGeometry args={[2.5, 0.04, 15]} />
        <meshStandardMaterial
          color="#2a1a0a"
          emissive="#f59e0b"
          emissiveIntensity={0.05}
          roughness={0.75}
        />
      </mesh>

      {/* Purple lane surface — dark crystal */}
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

/* ─── GLB Dragon Model ──────────────────────────────────── */

interface DragonProps {
  xLane: number;
  modelPath: string;
  tintColor: string;
  emissiveColor: string;
  scale: number;
  rotationY: number;
  zRef: React.RefObject<number>;
  sparkRef: React.RefObject<boolean>;
}

function Dragon({ xLane, modelPath, tintColor, emissiveColor, scale, rotationY, zRef, sparkRef }: DragonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);
  const clonedScene = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = (child.material as THREE.MeshStandardMaterial).clone();
        mat.color.set(tintColor);
        mat.emissive = new THREE.Color(emissiveColor);
        mat.emissiveIntensity = 0.4;
        mat.metalness = 0.5;
        mat.roughness = 0.35;
        child.material = mat;
        child.castShadow = true;
      }
    });
    clonedScene.current = clone;
  }, [scene, tintColor, emissiveColor]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z,
      zRef.current,
      0.18
    );
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 4.5 + xLane * 2) * 0.08;
    // Wing-flap tilt
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 6 + xLane) * 0.06;

    if (sparkGroupRef.current) {
      sparkGroupRef.current.visible = sparkRef.current;
    }
  });

  return (
    <group ref={groupRef} position={[xLane, 0.1, 0]}>
      {clonedScene.current && (
        <primitive
          object={clonedScene.current}
          scale={scale}
          rotation={[0, rotationY, 0]}
        />
      )}
      {/* Speed sparks trail */}
      <group ref={sparkGroupRef} visible={false} position={[0, 0.2, -1.0]}>
        <Sparkles count={40} scale={[1.0, 0.6, 0.8]} size={9} speed={4.5} color={emissiveColor} />
      </group>
    </group>
  );
}

useGLTF.preload("/models/dragon-gold.glb");
useGLTF.preload("/models/dragon-purple.glb");

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

function CameraController({ shakeRef }: { shakeRef: React.RefObject<{ intensity: number; decay: number }> }) {
  const { camera } = useThree();
  const base = useRef(new THREE.Vector3(4.0, 5.0, -3.5));

  useFrame(() => {
    if (!shakeRef.current || shakeRef.current.intensity <= 0) {
      camera.position.lerp(base.current, 0.08);
      return;
    }
    const { intensity } = shakeRef.current;
    camera.position.x = base.current.x + (Math.random() - 0.5) * intensity;
    camera.position.y = base.current.y + (Math.random() - 0.5) * intensity;
    shakeRef.current.intensity *= shakeRef.current.decay;
    if (shakeRef.current.intensity < 0.001) shakeRef.current.intensity = 0;
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
      {/* Ambient — warm volcanic tone */}
      <ambientLight intensity={1.8} />
      <hemisphereLight args={["#ff6b35", "#1a0a05", 0.8]} />

      {/* Main overhead */}
      <directionalLight position={[2, 10, 5]} intensity={2.5} castShadow />

      {/* Gold dragon spotlight */}
      <pointLight position={[-1.4, 4, 6]} color="#f59e0b" intensity={60} distance={16} decay={2} />
      {/* Purple dragon spotlight */}
      <pointLight position={[1.4, 4, 6]} color="#a855f7" intensity={60} distance={16} decay={2} />
      {/* Lava glow from below */}
      <pointLight position={[0, -1, 6]} color="#ff4500" intensity={20} distance={14} decay={2} />
      {/* Finish line glow */}
      <pointLight position={[0, 3, 13]} color="#f59e0b" intensity={40} distance={12} decay={2} />
      {/* Back atmosphere */}
      <pointLight position={[0, 5, 16]} color="#ef4444" intensity={15} distance={14} decay={2} />

      <RaceTrack />

      {/* Gold dragon — left lane (real GLB model) */}
      <Dragon
        xLane={-1.4}
        modelPath="/models/dragon-gold.glb"
        tintColor="#b45309"
        emissiveColor="#f59e0b"
        scale={0.6}
        rotationY={0}
        zRef={goldZRef}
        sparkRef={goldSparkRef}
      />

      {/* Purple dragon — right lane (real GLB model) */}
      <Dragon
        xLane={1.4}
        modelPath="/models/dragon-purple.glb"
        tintColor="#7e22ce"
        emissiveColor="#a855f7"
        scale={0.5}
        rotationY={0}
        zRef={purpleZRef}
        sparkRef={purpleSparkRef}
      />

      <FinishExplosion finishRef={finishRef} />
      <CameraController shakeRef={shakeRef} />
    </>
  );
}

/* ─── Canvas ─────────────────────────────────────────────── */

const DragonRaceCanvas = forwardRef<DragonRaceCanvasHandle>((_, ref) => {
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
      camera={{ position: [4.0, 5.0, -3.5], fov: 56 }}
      shadows
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor("#0a0205");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        (camera as THREE.PerspectiveCamera).lookAt(0, 0.5, 8);
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

DragonRaceCanvas.displayName = "DragonRaceCanvas";

export default DragonRaceCanvas;
