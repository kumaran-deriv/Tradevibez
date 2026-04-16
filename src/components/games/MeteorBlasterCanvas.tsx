"use client";

import { useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export interface MeteorCanvasHandle {
  reset(upperRingY: number, lowerRingY: number): void;
  triggerTick(meteorY: number): void;
  triggerHit(which: "upper" | "lower"): void;
  triggerMiss(): void;
}

/* ─── Starfield ──────────────────────────────────────────── */

function Starfield() {
  const positions = useMemo(() => {
    const pos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = -12 - Math.random() * 30;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.055} sizeAttenuation />
    </points>
  );
}

/* ─── Meteor ─────────────────────────────────────────────── */

function Meteor({ targetYRef }: { targetYRef: React.RefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        targetYRef.current,
        0.11
      );
      meshRef.current.rotation.x += 0.016;
      meshRef.current.rotation.z += 0.011;
    }
    if (glowRef.current && meshRef.current) {
      glowRef.current.position.y = meshRef.current.position.y;
    }
  });

  return (
    <>
      {/* Soft glow halo behind meteor */}
      <mesh ref={glowRef} position={[0, 0, -0.3]}>
        <sphereGeometry args={[0.9, 10, 10]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.1} />
      </mesh>
      {/* Core meteor */}
      <mesh ref={meshRef} position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.42, 18, 18]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#f97316"
          emissiveIntensity={1.5}
          roughness={0.32}
          metalness={0.2}
        />
      </mesh>
    </>
  );
}

/* ─── Target Ring ────────────────────────────────────────── */

interface RingProps {
  yRef: React.RefObject<number>;
  baseColor: string;
  hitRef: React.RefObject<boolean>;
  missRef: React.RefObject<boolean>;
}

function TargetRing({ yRef, baseColor, hitRef, missRef }: RingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const fillMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = yRef.current;
      groupRef.current.rotation.z = clock.elapsedTime * 0.9;
    }
    if (matRef.current) {
      const pulse = (Math.sin(clock.elapsedTime * 2.8) + 1) * 0.5;
      if (hitRef.current) {
        matRef.current.emissiveIntensity = 4.5;
        matRef.current.opacity = 1.0;
      } else if (missRef.current) {
        matRef.current.emissiveIntensity = 0.04;
        matRef.current.opacity = 0.15;
      } else {
        matRef.current.emissiveIntensity = 0.35 + pulse * 0.5;
        matRef.current.opacity = 0.9;
      }
    }
    if (fillMatRef.current) {
      if (hitRef.current) {
        fillMatRef.current.opacity = 0.28;
      } else if (missRef.current) {
        fillMatRef.current.opacity = 0.03;
      } else {
        fillMatRef.current.opacity = 0.07;
      }
    }
    if (sparkGroupRef.current) {
      sparkGroupRef.current.visible = hitRef.current;
      sparkGroupRef.current.position.y = yRef.current;
    }
  });

  return (
    <>
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Outer glow ring */}
        <mesh>
          <torusGeometry args={[1.8, 0.12, 16, 80]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={0.2}
            transparent
            opacity={0.3}
          />
        </mesh>
        {/* Main ring */}
        <mesh>
          <torusGeometry args={[1.5, 0.075, 16, 80]} />
          <meshStandardMaterial
            ref={matRef}
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={0.4}
            transparent
            opacity={0.9}
          />
        </mesh>
        {/* Filled disc */}
        <mesh>
          <circleGeometry args={[1.5, 48]} />
          <meshBasicMaterial
            ref={fillMatRef}
            color={baseColor}
            transparent
            opacity={0.07}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {/* Explosion sparkles — positioned in world space, not child of rotating group */}
      <group ref={sparkGroupRef} visible={false} position={[0, 0, 0]}>
        <Sparkles count={120} scale={6} size={14} speed={6} color={baseColor} />
      </group>
    </>
  );
}

/* ─── Camera Shake ───────────────────────────────────────── */

function CameraShake({ shakeRef }: { shakeRef: React.RefObject<{ intensity: number; decay: number }> }) {
  const { camera } = useThree();
  const base = useRef(new THREE.Vector3(0, 0, 12));

  useFrame(() => {
    if (!shakeRef.current || shakeRef.current.intensity <= 0) {
      camera.position.lerp(base.current, 0.1);
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
  meteorTargetYRef: React.RefObject<number>;
  upperYRef: React.RefObject<number>;
  lowerYRef: React.RefObject<number>;
  upperHitRef: React.RefObject<boolean>;
  lowerHitRef: React.RefObject<boolean>;
  upperMissRef: React.RefObject<boolean>;
  lowerMissRef: React.RefObject<boolean>;
  shakeRef: React.RefObject<{ intensity: number; decay: number }>;
}

function Scene({
  meteorTargetYRef,
  upperYRef,
  lowerYRef,
  upperHitRef,
  lowerHitRef,
  upperMissRef,
  lowerMissRef,
  shakeRef,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.12} />
      {/* Orange point light follows meteor vibe */}
      <pointLight position={[0, 0, 4]} color="#f97316" intensity={3.5} distance={20} />
      {/* Ring accent lights */}
      <pointLight position={[-5, 3, 3]} color="#22c55e" intensity={1.0} distance={22} />
      <pointLight position={[5, -3, 3]} color="#ef4444" intensity={1.0} distance={22} />

      <Starfield />

      <Meteor targetYRef={meteorTargetYRef} />

      <TargetRing
        yRef={upperYRef}
        baseColor="#22c55e"
        hitRef={upperHitRef}
        missRef={upperMissRef}
      />
      <TargetRing
        yRef={lowerYRef}
        baseColor="#ef4444"
        hitRef={lowerHitRef}
        missRef={lowerMissRef}
      />

      <CameraShake shakeRef={shakeRef} />
    </>
  );
}

/* ─── Canvas ─────────────────────────────────────────────── */

const MeteorBlasterCanvas = forwardRef<MeteorCanvasHandle>((_, ref) => {
  const meteorTargetYRef = useRef<number>(0);
  const upperYRef = useRef<number>(2.5);
  const lowerYRef = useRef<number>(-2.5);
  const upperHitRef = useRef<boolean>(false);
  const lowerHitRef = useRef<boolean>(false);
  const upperMissRef = useRef<boolean>(false);
  const lowerMissRef = useRef<boolean>(false);
  const shakeRef = useRef<{ intensity: number; decay: number }>({ intensity: 0, decay: 0.84 });

  useImperativeHandle(ref, () => ({
    reset(upperRingY: number, lowerRingY: number) {
      upperYRef.current = upperRingY;
      lowerYRef.current = lowerRingY;
      meteorTargetYRef.current = 0;
      upperHitRef.current = false;
      lowerHitRef.current = false;
      upperMissRef.current = false;
      lowerMissRef.current = false;
      shakeRef.current = { intensity: 0, decay: 0.84 };
    },

    triggerTick(meteorY: number) {
      meteorTargetYRef.current = meteorY;
    },

    triggerHit(which: "upper" | "lower") {
      if (which === "upper") {
        upperHitRef.current = true;
        setTimeout(() => { upperHitRef.current = false; }, 1400);
      } else {
        lowerHitRef.current = true;
        setTimeout(() => { lowerHitRef.current = false; }, 1400);
      }
      shakeRef.current = { intensity: 0.5, decay: 0.81 };
    },

    triggerMiss() {
      upperMissRef.current = true;
      lowerMissRef.current = true;
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 54 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#01030b");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
    >
      <Scene
        meteorTargetYRef={meteorTargetYRef}
        upperYRef={upperYRef}
        lowerYRef={lowerYRef}
        upperHitRef={upperHitRef}
        lowerHitRef={lowerHitRef}
        upperMissRef={upperMissRef}
        lowerMissRef={lowerMissRef}
        shakeRef={shakeRef}
      />
    </Canvas>
  );
});

MeteorBlasterCanvas.displayName = "MeteorBlasterCanvas";

export default MeteorBlasterCanvas;
