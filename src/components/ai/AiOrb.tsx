import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, MeshDistortMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Premium AI orb — glowing particle sphere with morphing wireframe mesh.
 * Runs in a dedicated R3F canvas. SSR-safe: this module is only ever
 * imported behind <ClientOnly> via React.lazy from AiOrbMount.
 */
function OrbCore() {
  const group = useRef<THREE.Group>(null!);
  const wire = useRef<THREE.Mesh>(null!);
  const inner = useRef<THREE.Mesh>(null!);
  const points = useRef<THREE.Points>(null!);
  const glow = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      // Slow 360° rotation + gentle float
      group.current.rotation.y = t * 0.18;
      group.current.rotation.x = Math.sin(t * 0.25) * 0.15;
      group.current.position.y = Math.sin(t * 0.6) * 0.08;
      // Breathing pulse
      const s = 1 + Math.sin(t * 1.2) * 0.03;
      group.current.scale.setScalar(s);
    }
    if (points.current) {
      points.current.rotation.y = -t * 0.09;
      points.current.rotation.z = t * 0.05;
    }
    if (wire.current) {
      wire.current.rotation.y = t * 0.22;
      wire.current.rotation.x = -t * 0.12;
    }
    if (glow.current) {
      const g = 1 + Math.sin(t * 0.9) * 0.05;
      glow.current.scale.setScalar(g);
    }
  });

  return (
    <group ref={group}>
      {/* Soft outer volumetric halo */}
      <mesh ref={glow}>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshBasicMaterial color="#ff7a00" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      {/* Inner solid core — dark warm base */}
      <Icosahedron ref={inner} args={[0.85, 6]}>
        <MeshDistortMaterial
          color="#3a1a05"
          emissive="#ff7a00"
          emissiveIntensity={0.7}
          roughness={0.35}
          metalness={0.55}
          distort={0.42}
          speed={1.6}
        />
      </Icosahedron>

      {/* Wireframe mesh — morphing lattice */}
      <Icosahedron ref={wire} args={[1.12, 4]}>
        <MeshDistortMaterial
          wireframe
          transparent
          color="#ffb066"
          emissive="#ff7a00"
          emissiveIntensity={1.2}
          distort={0.55}
          speed={2.1}
          opacity={0.9}
        />
      </Icosahedron>

      {/* Particle cloud — thousands of glowing points on a sphere */}
      <points ref={points}>
        <icosahedronGeometry args={[1.28, 7]} />
        <pointsMaterial
          size={0.018}
          color="#ffd18a"
          transparent
          opacity={0.95}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function AiOrb() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 3.6], fov: 45 }}
      frameloop="always"
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      {/* Warm brand-orange key light */}
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 2, 4]} intensity={2.2} color="#ff7a00" />
      {/* Subtle purple + electric-blue rim accents (never rainbow) */}
      <pointLight position={[-3, -1, 2]} intensity={0.9} color="#8b5cf6" />
      <pointLight position={[0, -3, 3]} intensity={0.6} color="#3b82f6" />

      <Suspense fallback={null}>
        <OrbCore />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={1.15}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}