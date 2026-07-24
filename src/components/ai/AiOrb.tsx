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
  const core = useRef<THREE.Mesh | null>(null);
  const limePulse = useRef<THREE.PointLight | null>(null);
  const cyanSweep = useRef<THREE.PointLight | null>(null);

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
      const mat = points.current.material as THREE.PointsMaterial;
      // Subtle silver shimmer
      mat.opacity = 0.75 + Math.sin(t * 2.2) * 0.12;
    }
    if (wire.current) {
      wire.current.rotation.y = t * 0.22;
      wire.current.rotation.x = -t * 0.12;
    }
    // Cyan energy slowly traveling across the mesh
    if (cyanSweep.current) {
      const r = 2.4;
      cyanSweep.current.position.x = Math.cos(t * 0.6) * r;
      cyanSweep.current.position.y = Math.sin(t * 0.45) * r * 0.6;
      cyanSweep.current.position.z = Math.sin(t * 0.6) * r;
    }
    // Very subtle lime pulse every ~6s
    if (limePulse.current) {
      const cycle = (t % 6) / 6;
      // sharp-ish bell curve peaking briefly
      const pulse = Math.max(0, Math.sin(cycle * Math.PI));
      limePulse.current.intensity = pulse * 0.9;
    }
  });

  return (
    <group ref={group}>
      {/* Luminous white core blending into electric cyan */}
      <Icosahedron ref={core} args={[0.78, 6]}>
        <MeshDistortMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={1.2}
          roughness={0.2}
          metalness={0.1}
          transparent
          opacity={0.95}
          distort={0.42}
          speed={1.6}
        />
      </Icosahedron>
      {/* Electric cyan halo around core (radial gradient feel) */}
      <Icosahedron args={[0.98, 5]}>
        <MeshDistortMaterial
          color="#7DF9FF"
          emissive="#7DF9FF"
          emissiveIntensity={0.85}
          transparent
          opacity={0.3}
          roughness={0.3}
          metalness={0.2}
          distort={0.5}
          speed={1.4}
        />
      </Icosahedron>

      {/* Wireframe mesh — bright cyan lattice */}
      <Icosahedron ref={wire} args={[1.12, 4]}>
        <MeshDistortMaterial
          wireframe
          transparent
          color="#BDFBFF"
          emissive="#BDFBFF"
          emissiveIntensity={0.95}
          distort={0.55}
          speed={2.1}
          opacity={0.88}
        />
      </Icosahedron>

      {/* Particle cloud — crisp white orbiting sparkles */}
      <points ref={points}>
        <icosahedronGeometry args={[1.28, 7]} />
        <pointsMaterial
          size={0.016}
          color="#FFFFFF"
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Electric cyan energy sweeping across the mesh */}
      <pointLight ref={cyanSweep} position={[2, 0, 1]} intensity={1.6} color="#00E5FF" distance={6} decay={2} />
      {/* Kept ref for animation compatibility — unused pulse */}
      <pointLight ref={limePulse} position={[0, 0, 1.2]} intensity={0} color="#7DF9FF" distance={4} decay={2} />
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
      {/* White key + soft cyan rim, subtle lime accent */}
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 2, 4]} intensity={1.8} color="#FFFFFF" />
      <pointLight position={[-3, -1, 2]} intensity={1.1} color="#7DF9FF" />
      <pointLight position={[0, -3, 3]} intensity={0.4} color="#00E5FF" />

      <Suspense fallback={null}>
        <OrbCore />
      </Suspense>
    </Canvas>
  );
}