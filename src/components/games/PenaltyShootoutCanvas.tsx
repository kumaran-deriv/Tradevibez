"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export interface ShootoutCanvasHandle {
  reset(): void;
  triggerKick(kickIndex: number): void;
  triggerGoal(kickIndex: number): void;
  triggerSave(kickIndex: number): void;
  triggerFinalResult(goals: number): void;
}

/* ─── Pitch ──────────────────────────────────────────────── */

function Pitch() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color="#1a6b2a" roughness={0.9} />
      </mesh>
      {/* Penalty spot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -3]}>
        <circleGeometry args={[0.12, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Goal area box lines */}
      {[[-3.66, 0.01, 3], [3.66, 0.01, 3]].map(([x, y, z], i) => (
        <mesh key={`gline-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]}>
          <planeGeometry args={[0.05, 4]} />
          <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1]}>
        <planeGeometry args={[7.37, 0.05]} />
        <meshStandardMaterial color="#ffffff" opacity={0.3} transparent />
      </mesh>
    </>
  );
}

/* ─── Goal Posts ─────────────────────────────────────────── */

function GoalPosts() {
  const postMaterial = { color: "#ffffff", metalness: 0.6, roughness: 0.3 };
  return (
    <group>
      {/* Left post */}
      <mesh position={[-3.66, 1.22, 5]} castShadow>
        <boxGeometry args={[0.1, 2.44, 0.1]} />
        <meshStandardMaterial {...postMaterial} />
      </mesh>
      {/* Right post */}
      <mesh position={[3.66, 1.22, 5]} castShadow>
        <boxGeometry args={[0.1, 2.44, 0.1]} />
        <meshStandardMaterial {...postMaterial} />
      </mesh>
      {/* Crossbar */}
      <mesh position={[0, 2.44, 5]} castShadow>
        <boxGeometry args={[7.42, 0.1, 0.1]} />
        <meshStandardMaterial {...postMaterial} />
      </mesh>
      {/* Net backdrop */}
      <mesh position={[0, 1.22, 5.6]}>
        <planeGeometry args={[7.2, 2.4]} />
        <meshStandardMaterial
          color="#cccccc"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Net top */}
      <mesh position={[0, 2.44, 5.3]} rotation={[Math.PI / 4, 0, 0]}>
        <planeGeometry args={[7.2, 0.8]} />
        <meshStandardMaterial
          color="#cccccc"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ─── Ball ────────────────────────────────────────────────── */

function Ball({
  ballPosRef,
  ballVelRef,
}: {
  ballPosRef: React.RefObject<THREE.Vector3>;
  ballVelRef: React.RefObject<THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const pos = ballPosRef.current;
    const vel = ballVelRef.current;

    // Apply velocity
    if (vel.lengthSq() > 0.0001) {
      pos.x += vel.x * delta * 60;
      pos.y += vel.y * delta * 60;
      pos.z += vel.z * delta * 60;

      // Gravity on y
      vel.y -= 0.003 * delta * 60;

      // Damping
      vel.multiplyScalar(0.98);

      // Floor clamp
      if (pos.y < 0.22) {
        pos.y = 0.22;
        vel.y = Math.abs(vel.y) * 0.3;
      }
    }

    meshRef.current.position.lerp(pos, 0.25);
    meshRef.current.rotation.x += vel.z * 2;
  });

  return (
    <mesh ref={meshRef} position={[0, 0.22, -3]} castShadow>
      <sphereGeometry args={[0.22, 20, 20]} />
      <meshStandardMaterial color="#f8f8f8" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

/* ─── Goalkeeper ──────────────────────────────────────────── */

function Goalkeeper({
  keeperPosRef,
  keeperRotRef,
}: {
  keeperPosRef: React.RefObject<{ x: number; z: number }>;
  keeperRotRef: React.RefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyColor = "#1e3a5f";
  const skinColor = "#d4a574";

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      keeperPosRef.current.x,
      0.12
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      keeperRotRef.current,
      0.12
    );
  });

  return (
    <group ref={groupRef} position={[0, 0, 4.5]}>
      {/* Torso */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.5, 0.8, 0.3]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.4, 1.2, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.4, 1.2, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Left leg */}
      <mesh position={[-0.15, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.15, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
}

/* ─── Stadium Lights ─────────────────────────────────────── */

function StadiumLights() {
  return (
    <>
      <spotLight
        position={[-5, 8, 2]}
        angle={0.5}
        penumbra={0.6}
        intensity={80}
        color="#ffffff"
        castShadow
        target-position={[0, 0, 5]}
      />
      <spotLight
        position={[5, 8, 2]}
        angle={0.5}
        penumbra={0.6}
        intensity={80}
        color="#ffffff"
        castShadow
        target-position={[0, 0, 5]}
      />
    </>
  );
}

/* ─── Goal Celebration Particles ─────────────────────────── */

function GoalCelebration({
  celebRef,
}: {
  celebRef: React.RefObject<{ active: boolean }>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = celebRef.current.active;
    }
  });

  return (
    <group ref={groupRef} visible={false} position={[0, 1.5, 5.2]}>
      <Sparkles count={150} scale={[6, 3, 2]} size={14} speed={7} color="#22c55e" />
      <Sparkles count={80} scale={[4, 2, 1.5]} size={10} speed={5} color="#f59e0b" />
    </group>
  );
}

/* ─── Save Celebration Particles ─────────────────────────── */

function SaveCelebration({
  celebRef,
}: {
  celebRef: React.RefObject<{ active: boolean }>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = celebRef.current.active;
    }
  });

  return (
    <group ref={groupRef} visible={false} position={[0, 1.2, 4.5]}>
      <Sparkles count={80} scale={[4, 2, 2]} size={8} speed={4} color="#ef4444" />
      <Sparkles count={40} scale={[3, 1.5, 1.5]} size={6} speed={3} color="#6b7280" />
    </group>
  );
}

/* ─── Final Result Celebration ───────────────────────────── */

function FinalCelebration({
  celebRef,
}: {
  celebRef: React.RefObject<{ active: boolean; big: boolean }>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = celebRef.current.active;
    }
  });

  return (
    <group ref={groupRef} visible={false} position={[0, 2, 2]}>
      <Sparkles count={300} scale={12} size={20} speed={10} color="#f59e0b" />
      <Sparkles count={150} scale={8} size={14} speed={8} color="#22c55e" />
    </group>
  );
}

/* ─── Camera Controller ──────────────────────────────────── */

function CameraController({
  shakeRef,
}: {
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
}) {
  const { camera } = useThree();

  useFrame(() => {
    const baseX = 0;
    const baseY = 2.5;
    const baseZ = -6;

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

    camera.lookAt(0, 1, 5);
  });

  return null;
}

/* ─── Scene ──────────────────────────────────────────────── */

interface SceneProps {
  ballPosRef: React.RefObject<THREE.Vector3>;
  ballVelRef: React.RefObject<THREE.Vector3>;
  keeperPosRef: React.RefObject<{ x: number; z: number }>;
  keeperRotRef: React.RefObject<number>;
  goalCelebRef: React.RefObject<{ active: boolean }>;
  saveCelebRef: React.RefObject<{ active: boolean }>;
  finalCelebRef: React.RefObject<{ active: boolean; big: boolean }>;
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
}

function Scene({
  ballPosRef,
  ballVelRef,
  keeperPosRef,
  keeperRotRef,
  goalCelebRef,
  saveCelebRef,
  finalCelebRef,
  shakeRef,
}: SceneProps) {
  return (
    <>
      {/* Ambient — outdoor pitch tone */}
      <ambientLight intensity={1.2} />
      <hemisphereLight args={["#87ceeb", "#1a6b2a", 0.6]} />

      {/* Main overhead */}
      <directionalLight position={[0, 10, 0]} intensity={1.5} castShadow />

      {/* Pitch glow */}
      <pointLight position={[0, 0.5, 1]} color="#22c55e" intensity={5} distance={12} decay={2} />

      <StadiumLights />
      <Pitch />
      <GoalPosts />
      <Ball ballPosRef={ballPosRef} ballVelRef={ballVelRef} />
      <Goalkeeper keeperPosRef={keeperPosRef} keeperRotRef={keeperRotRef} />
      <GoalCelebration celebRef={goalCelebRef} />
      <SaveCelebration celebRef={saveCelebRef} />
      <FinalCelebration celebRef={finalCelebRef} />
      <CameraController shakeRef={shakeRef} />
    </>
  );
}

/* ─── Canvas ─────────────────────────────────────────────── */

const PenaltyShootoutCanvas = forwardRef<ShootoutCanvasHandle>((_, ref) => {
  const ballPosRef    = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.22, -3));
  const ballVelRef    = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const keeperPosRef  = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const keeperRotRef  = useRef<number>(0);
  const goalCelebRef  = useRef<{ active: boolean }>({ active: false });
  const saveCelebRef  = useRef<{ active: boolean }>({ active: false });
  const finalCelebRef = useRef<{ active: boolean; big: boolean }>({ active: false, big: false });
  const shakeRef      = useRef<{ intensity: number; decay: number }>({ intensity: 0, decay: 0.84 });

  // Track ball target for keeper AI
  const ballTargetXRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    reset() {
      ballPosRef.current.set(0, 0.22, -3);
      ballVelRef.current.set(0, 0, 0);
      keeperPosRef.current = { x: 0, z: 0 };
      keeperRotRef.current = 0;
      goalCelebRef.current = { active: false };
      saveCelebRef.current = { active: false };
      finalCelebRef.current = { active: false, big: false };
      shakeRef.current = { intensity: 0, decay: 0.84 };
      ballTargetXRef.current = 0;
    },

    triggerKick(kickIndex: number) {
      // Reset ball to penalty spot
      ballPosRef.current.set(0, 0.22, -3);
      ballVelRef.current.set(0, 0, 0);
      keeperPosRef.current = { x: 0, z: 0 };
      keeperRotRef.current = 0;

      // Pick random target in goal area
      const targetX = (Math.random() - 0.5) * 5;
      const targetY = Math.random() * 1.5 + 0.5;
      ballTargetXRef.current = targetX;

      // Calculate velocity toward goal
      const dirX = targetX * 0.04;
      const dirY = targetY * 0.02 + 0.03;
      const dirZ = 0.15 + kickIndex * 0.005;

      ballVelRef.current.set(dirX, dirY, dirZ);
    },

    triggerGoal(kickIndex: number) {
      // Ball ends in net
      const targetX = ballTargetXRef.current;
      ballVelRef.current.set(targetX * 0.01, 0.01, 0.05);

      // Keeper dives wrong way (opposite of ball)
      const keeperDiveX = targetX > 0 ? -2.5 : 2.5;
      keeperPosRef.current = { x: keeperDiveX, z: 0 };
      keeperRotRef.current = targetX > 0 ? 0.5 : -0.5;

      // Celebrations
      goalCelebRef.current = { active: true };
      shakeRef.current = { intensity: 0.3, decay: 0.84 };

      setTimeout(() => {
        goalCelebRef.current = { active: false };
      }, 1500);

      // Ignore kickIndex lint — used for future extensibility
      void kickIndex;
    },

    triggerSave(kickIndex: number) {
      // Keeper dives to block (same direction as ball)
      const targetX = ballTargetXRef.current;
      const keeperDiveX = targetX > 0 ? Math.min(targetX + 0.5, 2.5) : Math.max(targetX - 0.5, -2.5);
      keeperPosRef.current = { x: keeperDiveX, z: 0 };
      keeperRotRef.current = targetX > 0 ? -0.5 : 0.5;

      // Ball deflects away
      ballVelRef.current.set(
        targetX > 0 ? -0.08 : 0.08,
        0.06,
        -0.04
      );

      // Save celebration
      saveCelebRef.current = { active: true };
      shakeRef.current = { intensity: 0.2, decay: 0.84 };

      setTimeout(() => {
        saveCelebRef.current = { active: false };
      }, 1200);

      void kickIndex;
    },

    triggerFinalResult(goals: number) {
      if (goals >= 3) {
        // Big gold celebration
        finalCelebRef.current = { active: true, big: true };
        shakeRef.current = { intensity: 0.6, decay: 0.78 };
      } else {
        // Subdued ending — dim scene slightly via shake only
        finalCelebRef.current = { active: false, big: false };
        shakeRef.current = { intensity: 0.1, decay: 0.92 };
      }

      setTimeout(() => {
        finalCelebRef.current = { active: false, big: false };
      }, 3000);
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 2.5, -6], fov: 52 }}
      shadows
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor("#0a1a0f");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        (camera as THREE.PerspectiveCamera).lookAt(0, 1, 5);
      }}
    >
      <Scene
        ballPosRef={ballPosRef}
        ballVelRef={ballVelRef}
        keeperPosRef={keeperPosRef}
        keeperRotRef={keeperRotRef}
        goalCelebRef={goalCelebRef}
        saveCelebRef={saveCelebRef}
        finalCelebRef={finalCelebRef}
        shakeRef={shakeRef}
      />
    </Canvas>
  );
});

PenaltyShootoutCanvas.displayName = "PenaltyShootoutCanvas";

export default PenaltyShootoutCanvas;
