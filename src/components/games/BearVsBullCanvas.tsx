"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles, useGLTF, useAnimations, Text } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────── */

export type CharacterState = "idle" | "attack" | "hit" | "ko" | "victory";
export type CameraPhase = "idle" | "battle" | "ko_bull" | "ko_bear" | "victory";

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
  triggerBattleStart: () => void;
  updateHP: (bullHP: number, bearHP: number) => void;
  resetArena: () => void;
}

/* ─── Camera targets ─────────────────────────────────────── */

const CAM_TARGETS: Record<CameraPhase, { pos: THREE.Vector3; look: THREE.Vector3 }> = {
  idle:    { pos: new THREE.Vector3(0, 2.2, 10.5),  look: new THREE.Vector3(0, 0.7, 0) },
  battle:  { pos: new THREE.Vector3(0, 2.0, 9.0),   look: new THREE.Vector3(0, 0.8, 0) },
  ko_bull: { pos: new THREE.Vector3(-4.8, 1.1, 7.0), look: new THREE.Vector3(-3.6, 0.3, 0) },
  ko_bear: { pos: new THREE.Vector3(4.8, 1.1, 7.0),  look: new THREE.Vector3(3.6, 0.3, 0) },
  victory: { pos: new THREE.Vector3(0, 2.8, 7.0),   look: new THREE.Vector3(0, 1.1, 0) },
};

/* ─── Camera controller ──────────────────────────────────── */

function CameraController({
  phaseRef,
  shakeRef,
}: {
  phaseRef: React.MutableRefObject<CameraPhase>;
  shakeRef: React.MutableRefObject<{ intensity: number; decay: number }>;
}) {
  const { camera } = useThree();
  const lookAtVec = useRef(new THREE.Vector3(0, 0.7, 0));

  useFrame(() => {
    const tgt = CAM_TARGETS[phaseRef.current];
    camera.position.lerp(tgt.pos, 0.04);
    lookAtVec.current.lerp(tgt.look, 0.04);
    camera.lookAt(lookAtVec.current);

    const s = shakeRef.current;
    if (s.intensity > 0) {
      camera.position.x += (Math.random() - 0.5) * s.intensity;
      camera.position.y += (Math.random() - 0.5) * s.intensity;
      camera.position.z += (Math.random() - 0.5) * s.intensity * 0.3;
      s.intensity *= s.decay;
      if (s.intensity < 0.001) s.intensity = 0;
    }
  });

  return null;
}

/* ─── 3D HP Bar ──────────────────────────────────────────── */

const HP_BAR_W = 2.2;

function HPBar3D({
  hpRef,
  position,
  side,
}: {
  hpRef: React.MutableRefObject<number>;
  position: [number, number, number];
  side: "bull" | "bear";
}) {
  const fillRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!fillRef.current) return;
    const pct = Math.max(0.001, Math.min(1, hpRef.current / 100));
    fillRef.current.scale.x = pct;
    // Anchor fill: bull anchors left edge, bear anchors right edge
    fillRef.current.position.x = side === "bull"
      ? HP_BAR_W * (pct - 1) / 2
      : HP_BAR_W * (1 - pct) / 2;

    const mat = fillRef.current.material as THREE.MeshStandardMaterial;
    if (pct > 0.5) {
      mat.color.setStyle("#22c55e");
      mat.emissive.setStyle("#22c55e");
    } else if (pct > 0.25) {
      mat.color.setStyle("#eab308");
      mat.emissive.setStyle("#eab308");
    } else {
      mat.color.setStyle("#ef4444");
      mat.emissive.setStyle("#ef4444");
    }
    mat.emissiveIntensity = 0.3 + (1 - pct) * 0.5;
  });

  const borderColor = side === "bull" ? "#22c55e" : "#ef4444";

  return (
    <group position={position}>
      {/* Border outline */}
      <mesh>
        <boxGeometry args={[HP_BAR_W + 0.06, 0.24, 0.03]} />
        <meshStandardMaterial color={borderColor} emissive={borderColor} emissiveIntensity={0.12} roughness={0.5} />
      </mesh>
      {/* Dark background track */}
      <mesh>
        <boxGeometry args={[HP_BAR_W, 0.18, 0.05]} />
        <meshStandardMaterial color="#0c1624" roughness={0.9} />
      </mesh>
      {/* Fill bar */}
      <mesh ref={fillRef}>
        <boxGeometry args={[HP_BAR_W, 0.13, 0.08]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

/* ─── Impact Ring ────────────────────────────────────────── */

interface RingState {
  active: boolean;
  t: number;
  pos: [number, number, number];
  color: string;
}

function ImpactRing({ ringRef }: { ringRef: React.MutableRefObject<RingState> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const s = ringRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!s.active) { mesh.visible = false; return; }

    s.t += delta;
    const duration = 0.48;
    const progress = Math.min(s.t / duration, 1);

    mesh.visible = true;
    mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
    const sc = 0.15 + progress * 3.2;
    mesh.scale.set(sc, sc, sc);

    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1 - progress) * 0.8;
    mat.color.setStyle(s.color);

    if (progress >= 1) { s.active = false; mesh.visible = false; }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.65, 1.0, 48]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Impact Sparkles ────────────────────────────────────── */

function ImpactSparkles({
  impactRef,
}: {
  impactRef: React.MutableRefObject<{ active: boolean; pos: [number, number, number]; color: string }>;
}) {
  const greenRef = useRef<THREE.Group>(null);
  const redRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const { active, pos, color } = impactRef.current;
    const isBull = color === "#22c55e";
    if (greenRef.current) {
      greenRef.current.visible = active && isBull;
      if (active && isBull) greenRef.current.position.set(...pos);
    }
    if (redRef.current) {
      redRef.current.visible = active && !isBull;
      if (active && !isBull) redRef.current.position.set(...pos);
    }
  });

  return (
    <>
      <group ref={greenRef} visible={false}>
        <Sparkles count={55} scale={2.4} size={8} speed={5} color="#22c55e" />
      </group>
      <group ref={redRef} visible={false}>
        <Sparkles count={55} scale={2.4} size={8} speed={5} color="#ef4444" />
      </group>
    </>
  );
}

/* ─── Arena ──────────────────────────────────────────────── */

function Arena() {
  return (
    <>
      {/* Outer floor — deep purple gradient feel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial color="#1a0e2e" roughness={0.85} metalness={0.06} />
      </mesh>

      {/* Ring canvas platform — rich dark blue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.56, 0]} receiveShadow>
        <planeGeometry args={[17, 9.5]} />
        <meshStandardMaterial color="#1a2848" roughness={0.8} />
      </mesh>

      {/* Center glow divider — brighter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 0]}>
        <planeGeometry args={[0.1, 9.5]} />
        <meshBasicMaterial color="#14b8a6" opacity={0.75} transparent />
      </mesh>

      {/* Grid overlay — more visible */}
      <gridHelper args={[28, 28, "#2a1a50", "#1a1040"]} position={[0, -0.6, 0]} />

      {/* Back wall — gradient dark purple */}
      <mesh position={[0, 3.5, -7]}>
        <planeGeometry args={[28, 12]} />
        <meshStandardMaterial color="#12082a" roughness={0.9} />
      </mesh>

      {/* Ring ropes — golden/bright */}
      {([0.18, 0.62, 1.06] as number[]).map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, 17, 6]} />
          <meshStandardMaterial
            color={i === 2 ? "#c084fc" : i === 1 ? "#f59e0b" : "#38bdf8"}
            emissive={i === 2 ? "#c084fc" : i === 1 ? "#f59e0b" : "#38bdf8"}
            emissiveIntensity={0.3}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Corner posts — glowing purple */}
      {([-8, 8] as number[]).flatMap((x) =>
        ([-4.5, 4.5] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.45, z]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 2.1, 10]} />
            <meshStandardMaterial color="#6d28d9" emissive="#6d28d9" emissiveIntensity={0.15} metalness={0.5} roughness={0.4} />
          </mesh>
        ))
      )}

      {/* Audience silhouettes — slightly colored */}
      {([-6.5, -4.5, -2.5, 0, 2.5, 4.5, 6.5] as number[]).map((x, i) => (
        <mesh key={x} position={[x, 0.0, -6.2]}>
          <boxGeometry args={[0.55, 1.4, 0.25]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#1a1040" : "#140c30"} />
        </mesh>
      ))}

      {/* Floor accent lights (bull side green, bear side red) — much brighter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.6, -0.55, 0]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#22c55e" opacity={0.12} transparent />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.6, -0.55, 0]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#ef4444" opacity={0.12} transparent />
      </mesh>

      {/* Center stage spotlight glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.53, 0]}>
        <circleGeometry args={[2.5, 32]} />
        <meshBasicMaterial color="#a855f7" opacity={0.06} transparent />
      </mesh>
    </>
  );
}

/* ─── Bull animation map ─────────────────────────────────── */

const BULL_ANIM_MAP: Record<CharacterState, string> = {
  idle:    "Idle",
  attack:  "Attack_Headbutt",
  hit:     "Idle_HitReact_Left",
  ko:      "Death",
  victory: "Idle_2",
};

/* ─── Bull Model (GLTF + animations) ────────────────────── */

function BullModel({
  stateRef,
  matRef,
}: {
  stateRef: React.MutableRefObject<{ state: CharacterState; timer: number }>;
  matRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/bull.glb");
  const { actions, mixer } = useAnimations(animations, groupRef);
  const prevState = useRef<CharacterState>("idle");

  useEffect(() => {
    const idle = actions["Idle"];
    if (idle) idle.reset().fadeIn(0.3).play();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !matRef.current) {
        matRef.current = child.material as THREE.MeshStandardMaterial;
      }
    });
  }, [actions, scene, matRef]);

  useEffect(() => {
    const onFinished = () => {
      const s = stateRef.current.state;
      if (s !== "idle" && s !== "ko" && s !== "victory") {
        stateRef.current.state = "idle";
      }
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer, stateRef]);

  useFrame((_, delta) => {
    mixer.update(delta);
    const { state } = stateRef.current;
    if (state === prevState.current) return;
    prevState.current = state;

    const animName = BULL_ANIM_MAP[state];
    if (!animName) return;

    Object.values(actions).forEach((a) => a?.fadeOut(0.1));
    const action = actions[animName];
    if (!action) return;
    action.reset().fadeIn(0.1);
    if (state === "idle" || state === "victory") {
      action.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    action.play();
  });

  return (
    <group ref={groupRef} position={[-3.6, -0.6, 0]}>
      <primitive object={scene} scale={0.58} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

useGLTF.preload("/models/bull.glb");

/* ─── Bear Model (transform-animated) ───────────────────── */

function BearModel({
  stateRef,
  matRef,
}: {
  stateRef: React.MutableRefObject<{ state: CharacterState; timer: number }>;
  matRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/bear.glb");
  const BASE_X = 3.6;

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !matRef.current) {
        matRef.current = child.material as THREE.MeshStandardMaterial;
      }
    });
  }, [scene, matRef]);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const { state, timer } = stateRef.current;
    const t = clock.elapsedTime;

    if (state === "idle") {
      // Breathing sway — only position and Z tilt, never touch rotation.y (primitive owns it)
      g.position.x += (BASE_X - g.position.x) * 0.1;
      g.position.y += (Math.sin(t * 1.4 + 1.2) * 0.06 - g.position.y) * 0.08;
      g.rotation.z += (0 - g.rotation.z) * 0.1;
      if (matRef.current) {
        matRef.current.emissiveIntensity += (0 - matRef.current.emissiveIntensity) * 0.12;
      }
    } else if (state === "attack") {
      const elapsed = Date.now() / 1000 - timer;
      const progress = Math.min(1, elapsed / 0.14);
      const lunge = Math.sin(progress * Math.PI);
      g.position.x = BASE_X - lunge * 2.8;
      g.position.y = -0.05 + lunge * 0.28;
      g.rotation.z = -lunge * 0.22;
      if (progress >= 1) stateRef.current.state = "idle";
    } else if (state === "hit") {
      const elapsed = Date.now() / 1000 - timer;
      const progress = Math.min(1, elapsed / 0.22);
      const inv = 1 - progress;
      g.position.x += (BASE_X + inv * 1.0 - g.position.x) * 0.25;
      g.position.y += (Math.sin(progress * Math.PI) * 0.32 - g.position.y) * 0.25;
      g.rotation.z += (inv * 0.45 - g.rotation.z) * 0.25;
      if (matRef.current) {
        matRef.current.emissive.setStyle("#ff2222");
        matRef.current.emissiveIntensity = Math.pow(inv, 0.55) * 2.5;
      }
      if (progress >= 1) {
        stateRef.current.state = "idle";
        if (matRef.current) matRef.current.emissiveIntensity = 0;
      }
    } else if (state === "ko") {
      // Defeat fall
      g.rotation.z += (Math.PI / 2 - g.rotation.z) * 0.05;
      g.position.y += (-0.72 - g.position.y) * 0.05;
      g.position.x += (BASE_X + 0.6 - g.position.x) * 0.04;
    } else if (state === "victory") {
      // Victory bounce
      g.position.y = Math.abs(Math.sin(t * 6.8)) * 0.58;
      g.rotation.z = Math.sin(t * 6.8) * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={[BASE_X, -0.6, 0]}>
      <primitive object={scene} scale={0.22} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

useGLTF.preload("/models/bear.glb");

/* ─── Scene ──────────────────────────────────────────────── */

interface SceneProps {
  bullStateRef: React.MutableRefObject<{ state: CharacterState; timer: number }>;
  bearStateRef: React.MutableRefObject<{ state: CharacterState; timer: number }>;
  bullMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
  bearMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
  impactRef: React.MutableRefObject<{ active: boolean; pos: [number, number, number]; color: string }>;
  ringRef: React.MutableRefObject<RingState>;
  shakeRef: React.MutableRefObject<{ intensity: number; decay: number }>;
  phaseRef: React.MutableRefObject<CameraPhase>;
  bullHPRef: React.MutableRefObject<number>;
  bearHPRef: React.MutableRefObject<number>;
}

function Scene({
  bullStateRef, bearStateRef, bullMatRef, bearMatRef,
  impactRef, ringRef, shakeRef, phaseRef, bullHPRef, bearHPRef,
}: SceneProps) {
  return (
    <>
      {/* Ambient base — brighter */}
      <ambientLight intensity={2.2} />
      <hemisphereLight args={["#4a3a8a", "#1a1040", 1.6]} />

      {/* Main overhead fill — stronger */}
      <directionalLight position={[0, 9, 5]} intensity={3.5} castShadow />

      {/* Bull spotlight — green, brighter */}
      <pointLight position={[-3.6, 6, 3]} color="#22c55e" intensity={120} distance={16} decay={2} />
      {/* Bear spotlight — red, brighter */}
      <pointLight position={[3.6, 6, 3]} color="#ef4444" intensity={120} distance={16} decay={2} />
      {/* Center purple accent */}
      <pointLight position={[0, 5, 2]} color="#a855f7" intensity={40} distance={14} decay={2} />
      {/* Back wall purple wash */}
      <pointLight position={[0, 4, -5]} color="#7c3aed" intensity={30} distance={12} decay={2} />
      {/* Rim lights for depth */}
      <pointLight position={[-6, 3, -3]} color="#3b82f6" intensity={25} distance={10} decay={2} />
      <pointLight position={[6, 3, -3]} color="#f97316" intensity={25} distance={10} decay={2} />

      {/* 3D HP bars — raised high above models */}
      <HPBar3D hpRef={bullHPRef} position={[-3.6, 2.8, 0]} side="bull" />
      <HPBar3D hpRef={bearHPRef} position={[3.6, 2.8, 0]} side="bear" />

      {/* 3D name labels — above HP bars */}
      <Text
        position={[-3.6, 3.25, 0]}
        fontSize={0.36}
        color="#22c55e"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        BULL
      </Text>
      <Text
        position={[3.6, 3.25, 0]}
        fontSize={0.36}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        BEAR
      </Text>

      <Arena />
      <BullModel stateRef={bullStateRef} matRef={bullMatRef} />
      <BearModel stateRef={bearStateRef} matRef={bearMatRef} />
      <ImpactSparkles impactRef={impactRef} />
      <ImpactRing ringRef={ringRef} />
      <CameraController phaseRef={phaseRef} shakeRef={shakeRef} />
    </>
  );
}

/* ─── Canvas (exported) ──────────────────────────────────── */

const BearVsBullCanvas = forwardRef<CanvasHandle>((_, ref) => {
  const bullStateRef = useRef<{ state: CharacterState; timer: number }>({ state: "idle", timer: 0 });
  const bearStateRef = useRef<{ state: CharacterState; timer: number }>({ state: "idle", timer: 0 });
  const bullMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const bearMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const impactRef = useRef<{ active: boolean; pos: [number, number, number]; color: string }>({
    active: false, pos: [0, 1, 0], color: "#22c55e",
  });
  const ringRef = useRef<RingState>({ active: false, t: 0, pos: [0, -0.54, 0], color: "#22c55e" });
  const shakeRef = useRef<{ intensity: number; decay: number }>({ intensity: 0, decay: 0.83 });
  const phaseRef = useRef<CameraPhase>("idle");
  const bullHPRef = useRef<number>(100);
  const bearHPRef = useRef<number>(100);

  useImperativeHandle(ref, () => ({
    triggerBattleStart() {
      phaseRef.current = "battle";
      bullHPRef.current = 100;
      bearHPRef.current = 100;
      bullStateRef.current = { state: "idle", timer: 0 };
      bearStateRef.current = { state: "idle", timer: 0 };
    },

    updateHP(bullHP: number, bearHP: number) {
      bullHPRef.current = bullHP;
      bearHPRef.current = bearHP;
    },

    resetArena() {
      phaseRef.current = "idle";
      bullHPRef.current = 100;
      bearHPRef.current = 100;
      bullStateRef.current = { state: "idle", timer: 0 };
      bearStateRef.current = { state: "idle", timer: 0 };
    },

    triggerTick(event: TickEvent) {
      if (event.direction === "flat") return;
      const color = event.attacker === "bull" ? "#22c55e" : "#ef4444";
      const hits = event.isCritical ? 3 : event.isCombo ? 3 : 2;

      for (let i = 0; i < hits; i++) {
        const delay = i * 180;
        setTimeout(() => {
          const now = Date.now() / 1000;
          if (event.attacker === "bull") {
            bullStateRef.current = { state: "attack", timer: now };
            setTimeout(() => {
              bearStateRef.current = { state: "hit", timer: Date.now() / 1000 };
            }, 100);
          } else {
            bearStateRef.current = { state: "attack", timer: now };
            setTimeout(() => {
              bullStateRef.current = { state: "hit", timer: Date.now() / 1000 };
            }, 100);
          }

          const ringPos: [number, number, number] =
            event.attacker === "bull" ? [3.6, -0.54, 0] : [-3.6, -0.54, 0];
          ringRef.current = { active: true, t: 0, pos: ringPos, color };

          const yJitter = 0.8 + Math.random() * 0.8;
          const impactPos: [number, number, number] = event.attacker === "bull"
            ? [2.0 + Math.random() * 0.6, yJitter, 0]
            : [-2.0 - Math.random() * 0.6, yJitter, 0];
          impactRef.current = { active: true, pos: impactPos, color };
          setTimeout(() => { impactRef.current.active = false; }, 300);

          shakeRef.current = {
            intensity: event.isCritical ? 0.25 : event.isCombo ? 0.12 : 0.05,
            decay: 0.83,
          };
        }, delay);
      }
    },

    triggerKO(loser: "bull" | "bear") {
      const now = Date.now() / 1000;
      if (loser === "bull") {
        bullStateRef.current = { state: "ko", timer: now };
        phaseRef.current = "ko_bull";
      } else {
        bearStateRef.current = { state: "ko", timer: now };
        phaseRef.current = "ko_bear";
      }
      shakeRef.current = { intensity: 0.42, decay: 0.87 };
    },

    triggerVictory(winner: "bull" | "bear") {
      const now = Date.now() / 1000;
      if (winner === "bull") bullStateRef.current = { state: "victory", timer: now };
      else bearStateRef.current = { state: "victory", timer: now };
      phaseRef.current = "victory";
    },
  }));

  return (
    <Canvas
      camera={{ position: [0, 2.2, 9.8], fov: 54 }}
      shadows
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0d0520");
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
    >
      <Scene
        bullStateRef={bullStateRef}
        bearStateRef={bearStateRef}
        bullMatRef={bullMatRef}
        bearMatRef={bearMatRef}
        impactRef={impactRef}
        ringRef={ringRef}
        shakeRef={shakeRef}
        phaseRef={phaseRef}
        bullHPRef={bullHPRef}
        bearHPRef={bearHPRef}
      />
    </Canvas>
  );
});

BearVsBullCanvas.displayName = "BearVsBullCanvas";

export default BearVsBullCanvas;
