"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Html, MeshReflectorMaterial, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { expectedGoals, HOME_ADV_CLUB } from "@/lib/model";

interface Club {
  club: string;
  slug: string;
  elo: number;
  logo?: string;
}

interface Hero3DProps {
  clubs: Club[];
  leagueName: string;
  reducedMotion?: boolean;
}

const SHOWN = 6;
const GAP = 1.42;
const MAX_HEIGHT = 3.55;
const PHOSPHOR = "#ffb43a";
const WARM_BONE = "#f5efe0";
const SILVER = "#c9bfa4";
const GRAPHITE = "#0a130c";
const FIELD_COLORS = [PHOSPHOR, WARM_BONE, "#cfc5a9", "#a99e80", "#87795c", "#665b42"];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rng: () => number) {
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = 1;
  do {
    k++;
    product *= rng();
  } while (product > limit);
  return k - 1;
}

function ProbabilityField({ reducedMotion }: { reducedMotion: boolean }) {
  const scanner = useRef<THREE.Group>(null);
  const pulseRings = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    if (reducedMotion) return;
    const elapsed = state.clock.elapsedTime;
    if (scanner.current) scanner.current.rotation.y = elapsed * 0.19;

    pulseRings.current.forEach((ring, index) => {
      if (!ring) return;
      const progress = (elapsed * 0.16 + index * 0.48) % 1;
      ring.scale.setScalar(0.82 + progress * 1.8);
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.28 * (1 - progress));
    });
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]}>
        <planeGeometry args={[24, 17]} />
        <MeshReflectorMaterial
          blur={[180, 52]}
          resolution={256}
          mixBlur={0.75}
          mixStrength={8}
          roughness={0.96}
          depthScale={0.55}
          minDepthThreshold={0.55}
          maxDepthThreshold={1.2}
          color={GRAPHITE}
          metalness={0.36}
          mirror={0.34}
        />
      </mesh>

      <gridHelper args={[18, 18, "#3f6b4a", "#1c3322"]} position={[0, 0.006, 0]} />

      {[0, 1].map((index) => (
        <mesh
          key={index}
          ref={(element) => { pulseRings.current[index] = element; }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.018, 0]}
        >
          <ringGeometry args={[1.98, 2.015, 96]} />
          <meshBasicMaterial
            color={index === 0 ? PHOSPHOR : SILVER}
            transparent
            opacity={reducedMotion ? 0.08 : 0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      <group ref={scanner} position={[0, 0.022, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.5, 0.018]} />
          <meshBasicMaterial
            color={PHOSPHOR}
            transparent
            opacity={reducedMotion ? 0 : 0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[4.72, 0.014, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color={PHOSPHOR} transparent opacity={0.88} />
        </mesh>
      </group>
    </group>
  );
}

function Towers({
  clubs,
  reducedMotion,
  onSnapshot,
}: {
  clubs: Club[];
  reducedMotion: boolean;
  onSnapshot: (simulations: number) => void;
}) {
  const clubCount = clubs.length;
  const simulation = useMemo(() => ({
    titles: new Uint32Array(clubCount),
    count: 0,
    rng: mulberry32(7),
  }), [clubCount]);
  const points = useMemo(() => new Int16Array(clubCount), [clubCount]);

  const expectedScore = useMemo(() => {
    const home: number[][] = [];
    const away: number[][] = [];
    for (let i = 0; i < clubCount; i++) {
      home[i] = [];
      away[i] = [];
      for (let j = 0; j < clubCount; j++) {
        if (i === j) {
          home[i][j] = 0;
          away[i][j] = 0;
          continue;
        }
        home[i][j] = expectedGoals(clubs[i].elo, clubs[j].elo, HOME_ADV_CLUB);
        away[i][j] = expectedGoals(clubs[j].elo, clubs[i].elo, -HOME_ADV_CLUB / 2);
      }
    }
    return { home, away };
  }, [clubs, clubCount]);

  const order = useMemo(() => clubs
    .map((club, index) => ({ index, elo: club.elo }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, SHOWN)
    .map(({ index }) => index), [clubs]);

  const towerRefs = useRef<(THREE.Group | null)[]>([]);
  const capRefs = useRef<(THREE.Mesh | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const heights = useRef(new Array(order.length).fill(0.05));
  const lastUiUpdate = useRef(-1);
  const lastSimulationUpdate = useRef(-1);

  const drops = useMemo(() => {
    const rng = mulberry32(20260714);
    return Array.from({ length: reducedMotion ? 0 : 72 }, () => ({
      column: Math.floor(rng() * Math.max(1, order.length)),
      y: 3.8 + rng() * 6.4,
      speed: 1.15 + rng() * 2.15,
      x: (rng() - 0.5) * 0.42,
      z: (rng() - 0.5) * 0.42,
      phase: rng() * Math.PI * 2,
    }));
  }, [order.length, reducedMotion]);
  const dropResetRng = useRef(mulberry32(108));
  const dropMesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    const frameDelta = Math.min(delta, 0.05);
    if (state.clock.elapsedTime - lastSimulationUpdate.current >= 0.1) {
      const batches = reducedMotion ? 1 : 8;
      for (let batch = 0; batch < batches; batch++) {
        points.fill(0);
        for (let i = 0; i < clubCount; i++) {
          for (let j = 0; j < clubCount; j++) {
            if (i === j) continue;
            const homeGoals = poisson(expectedScore.home[i][j], simulation.rng);
            const awayGoals = poisson(expectedScore.away[i][j], simulation.rng);
            if (homeGoals > awayGoals) points[i] += 3;
            else if (homeGoals < awayGoals) points[j] += 3;
            else {
              points[i]++;
              points[j]++;
            }
          }
        }

        let champion = 0;
        for (let i = 1; i < clubCount; i++) {
          if (points[i] > points[champion]) champion = i;
        }
        simulation.titles[champion]++;
        simulation.count++;
      }
      lastSimulationUpdate.current = state.clock.elapsedTime;
    }

    const shares = order.map((clubIndex) => simulation.titles[clubIndex] / Math.max(1, simulation.count));
    const maxShare = Math.max(...shares, 0.01);

    order.forEach((_, index) => {
      const target = 0.22 + Math.sqrt(shares[index] / maxShare) * MAX_HEIGHT;
      const easing = reducedMotion ? 1 : Math.min(1, frameDelta * 2.35);
      heights.current[index] += (target - heights.current[index]) * easing;

      const tower = towerRefs.current[index];
      if (tower) {
        const breathing = index === 0 && !reducedMotion
          ? Math.sin(state.clock.elapsedTime * 1.15) * 0.012
          : 0;
        tower.scale.y = heights.current[index] + breathing;
      }

      const cap = capRefs.current[index];
      if (cap) {
        cap.position.y = heights.current[index] + 0.018;
        if (index === 0 && !reducedMotion) {
          const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.05;
          cap.scale.set(pulse, 1, pulse);
        }
      }
    });

    if (state.clock.elapsedTime - lastUiUpdate.current >= 0.16) {
      order.forEach((clubIndex, index) => {
        const label = labelRefs.current[index];
        if (label) label.textContent = `${(simulation.titles[clubIndex] / Math.max(1, simulation.count) * 100).toFixed(1)}%`;
      });
      onSnapshot(simulation.count);
      lastUiUpdate.current = state.clock.elapsedTime;
    }

    if (dropMesh.current) {
      drops.forEach((drop, index) => {
        drop.y -= drop.speed * frameDelta;
        const floor = heights.current[drop.column] ?? 0.2;
        if (drop.y < floor + 0.08) {
          const rng = dropResetRng.current;
          drop.y = 4.3 + rng() * 5.8;
          drop.column = Math.floor(rng() * Math.max(1, order.length));
          drop.x = (rng() - 0.5) * 0.42;
          drop.z = (rng() - 0.5) * 0.42;
        }

        dummy.position.set(
          (drop.column - (order.length - 1) / 2) * GAP + drop.x,
          drop.y,
          drop.z,
        );
        const flicker = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4.2 + drop.phase + index);
        dummy.scale.set(0.025 + flicker * 0.018, 0.08 + flicker * 0.09, 0.025 + flicker * 0.018);
        dummy.updateMatrix();
        dropMesh.current!.setMatrixAt(index, dummy.matrix);
      });
      dropMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {order.map((clubIndex, index) => {
        const x = (index - (order.length - 1) / 2) * GAP;
        const leader = index === 0;
        const color = FIELD_COLORS[index];
        return (
          <group key={clubs[clubIndex].slug} position={[x, 0, 0]}>
            <group ref={(element) => { towerRefs.current[index] = element; }}>
              <RoundedBox args={[0.72, 1, 0.72]} radius={0.045} smoothness={3} position={[0, 0.5, 0]}>
                <meshPhysicalMaterial
                  color={leader ? "#7a4f14" : "#14231a"}
                  emissive={color}
                  emissiveIntensity={leader ? 0.28 : 0.08}
                  metalness={0.36}
                  roughness={0.32}
                  clearcoat={0.76}
                  clearcoatRoughness={0.42}
                  transparent
                  opacity={leader ? 0.9 : 0.78}
                />
                <Edges threshold={18} color={color} />
              </RoundedBox>
              <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[0.07, 0.92, 0.07]} />
                <meshBasicMaterial color={color} transparent opacity={leader ? 0.6 : 0.18} />
              </mesh>
            </group>

            <mesh ref={(element) => { capRefs.current[index] = element; }} position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.25, 0.34, 0.035, 32]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={leader ? 0.94 : 0.58}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
              <ringGeometry args={[0.45, 0.54, 48]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={leader ? 0.58 : 0.19}
                side={THREE.DoubleSide}
              />
            </mesh>

            <Html center distanceFactor={8.6} position={[0, -0.72, 0.44]} style={{ pointerEvents: "none" }}>
              <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", width: 100 }}>
                {clubs[clubIndex].logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={clubs[clubIndex].logo}
                    width={24}
                    height={24}
                    alt=""
                    style={{
                      objectFit: "contain",
                      filter: "grayscale(.92) contrast(1.12) drop-shadow(0 2px 7px rgba(4,8,5,.72))",
                      opacity: 0.86,
                    }}
                  />
                )}
                <div style={{
                  color: WARM_BONE,
                  fontSize: 10,
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textShadow: "0 1px 5px rgba(4,8,5,.9)",
                  whiteSpace: "nowrap",
                }}>
                  {clubs[clubIndex].club}
                </div>
                <span
                  ref={(element) => { labelRefs.current[index] = element; }}
                  style={{
                    color: leader ? PHOSPHOR : SILVER,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: ".02em",
                    textShadow: leader ? "0 0 8px rgba(255,180,58,.16)" : "0 1px 4px rgba(4,8,5,.82)",
                  }}
                >
                  0.0%
                </span>
              </div>
            </Html>
          </group>
        );
      })}

      {drops.length > 0 && (
        <instancedMesh ref={dropMesh} args={[undefined, undefined, drops.length]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial
            color={PHOSPHOR}
            transparent
            opacity={0.54}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>
      )}
    </group>
  );
}

export function Hero3D({ clubs, leagueName, reducedMotion = false }: Hero3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "180px 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const updateCount = useCallback((simulations: number) => {
    if (countRef.current) countRef.current.textContent = simulations.toLocaleString("en-US");
  }, []);

  return (
    <div ref={containerRef} className="hero3d-wrap">
      <div className="hero3d-hud" aria-label={`${leagueName} live probability simulation`}>
        <span className="pulse" aria-hidden />
        <b ref={countRef} className="tnum">0</b> seasons · live probability field
      </div>
      <Canvas
        camera={{ position: [0, 2.65, 8.05], fov: 39 }}
        dpr={[1, 1.45]}
        frameloop={active ? "always" : "never"}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ height: 440 }}
      >
        <color attach="background" args={[GRAPHITE]} />
        <fog attach="fog" args={[GRAPHITE, 9.5, 18]} />
        <ambientLight intensity={0.42} color={WARM_BONE} />
        <directionalLight position={[5, 8, 4]} intensity={1.05} color={WARM_BONE} />
        <pointLight position={[0, 5.5, -3]} intensity={42} color={PHOSPHOR} />
        <pointLight position={[-5, 2.5, 3]} intensity={16} color={SILVER} />
        <ProbabilityField reducedMotion={reducedMotion} />
        <Towers clubs={clubs} reducedMotion={reducedMotion} onSnapshot={updateCount} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.055}
          autoRotate={active && !reducedMotion}
          autoRotateSpeed={0.34}
          minPolarAngle={Math.PI / 3.45}
          maxPolarAngle={Math.PI / 2.28}
        />
      </Canvas>
      <div className="hero3d-hint">drag to inspect · height = title probability</div>
    </div>
  );
}
