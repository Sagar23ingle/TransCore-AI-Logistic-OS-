import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * Premium AI orb — glowing particle sphere with morphing wireframe mesh.
 * Runs in a dedicated R3F canvas. SSR-safe: this module is only ever
 * imported behind <ClientOnly> via React.lazy from AiOrbMount.
 */
function OrbCore() {
  const group = useRef<THREE.Group | null>(null);
  const wire = useRef<THREE.Mesh | null>(null);
  const points = useRef<THREE.Points | null>(null);

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
  });

  return (
    <group ref={group}>
      {/* Inner solid core — dark warm base */}
      <Icosahedron args={[0.85, 6]}>
        <MeshDistortMaterial
          color="#0B4650"
          emissive="#0B4650"
          emissiveIntensity={0.55}
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
          color="#0B4650"
          emissive="#0B4650"
          emissiveIntensity={1.0}
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
          color="#E6FF2B"
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
      className="tc-ai-orb-canvas"
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: true,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0);
        gl.setClearAlpha(0);
        scene.background = null;
      }}
      camera={{ position: [0, 0, 3.6], fov: 45 }}
      frameloop="always"
      style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
    >
      {/* Neon Lime key light + Deep Teal rim */}
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 2, 4]} intensity={2.2} color="#E6FF2B" />
      <pointLight position={[-3, -1, 2]} intensity={1.1} color="#0B4650" />
      <pointLight position={[0, -3, 3]} intensity={0.6} color="#ffffff" />

      <Suspense fallback={null}>
        <OrbCore />
      </Suspense>
    </Canvas>
  );
}