// Cleaned CityScene component without duplicate code
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  useGLTF,
  AdaptiveDpr,
  AdaptiveEvents,
  Preload,
  Sparkles,
  Stars,
  Billboard,
  Text,
  Image,
} from "@react-three/drei";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { createServerFn } from "@tanstack/react-start";
import fs from "fs";
import path from "path";

// Simple loading spinner component
function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-50">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const writeCoordsToServer = createServerFn({ method: "POST" })
  .inputValidator((coordsText: string) => coordsText)
  .handler(async ({ data: coordsText }) => {
    try {
      fs.writeFileSync("street_coords.txt", coordsText);
      return { success: true };
    } catch (e: any) {
      fs.writeFileSync("street_coords_error.txt", e.stack);
      return { success: false, error: e.message };
    }
  });

const runParserOnServer = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const glbPath = path.resolve("public/models/future_city.glb");
      if (fs.existsSync(glbPath)) {
        const buffer = fs.readFileSync(glbPath);
        const magic = buffer.toString("utf8", 0, 4);
        if (magic === "glTF") {
          const chunkLength = buffer.readUInt32LE(12);
          const jsonString = buffer.toString("utf8", 20, 20 + chunkLength);
          const gltf = JSON.parse(jsonString);
          const nodesData = gltf.nodes?.map((n: any, idx: number) => ({
            index: idx,
            name: n.name,
            mesh: n.mesh !== undefined ? gltf.meshes[n.mesh]?.name : undefined,
            translation: n.translation,
            scale: n.scale,
            rotation: n.rotation,
            matrix: n.matrix,
          })) || [];
          return { success: true, count: nodesData.length };
        }
      }
      return { success: false, reason: "file not found" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

// ---------- Path waypoints (L-shape through the city) ----------
export const WAYPOINTS: [number, number, number][] = [
  [70, 7.35, -180],
  [70, 7.35, -120],
  [70, 7.35, -60],
  [70, 7.35, 5.33],
  [30, 7.35, 5.33],
  [-10, 7.35, 5.33],
  [-50, 7.35, 5.33],
  [-100, 7.35, 5.33],
  [-160, 7.35, 5.33],
];

export const SECTIONS = [
  { eyebrow: "المرحلة ٠١ · التخطيط", title: "التصميم\nوالتخطيط", body: "أساس قوي لنجاح مشروعك.\nمرر للتعرف على مراحل التنفيذ.", color: "#ffffff", waypoint: 0, image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80" },
  { eyebrow: "تاريخنا · الأفق للمقاولات", eyebrowColor: "#111111", eyebrowSize: 0.95, title: "من\nنحن", body: "تأسست الشركة لتقديم حلول إنشائية\nمتطورة، بخبرة تمتد لأكثر من ٢٠ عاماً.", color: "#cccccc", waypoint: 2, image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80" },
  { eyebrow: "المرحلة ٠٣ · البناء", title: "الهيكل\nالإنشائي", body: "صب الخرسانات والحديد المسلح\nبأعلى المواصفات القياسية.", color: "#e0e0e0", waypoint: 4, offset: [-15, 0, 0], image: "https://images.unsplash.com/photo-1535868463750-c78d9543614f?auto=format&fit=crop&w=800&q=80" },
  { eyebrow: "المرحلة ٠٤ · التنفيذ", title: "أعمال\nالتشطيبات", body: "واجهات عصرية وديكورات\nداخلية تنبض بالفخامة.", color: "#b3b3b3", waypoint: 6, image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80" },
  { isStats: true, color: "#ffffff", waypoint: 8, image: "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?auto=format&fit=crop&w=800&q=80" },
];

export type MoveState = { forward: number; strafe: number; up: number; boost: boolean };

function City({ onReady, onMeshInfo }: { onReady: (g: THREE.Group) => void; onMeshInfo: (info: string) => void }) {
  const { scene } = useGLTF("/models/future_city.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
  const ref = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (mm: THREE.MeshStandardMaterial) => {
          if (!mm) return;
          if (mm.color) {
            const hsl = { h: 0, s: 0, l: 0 } as THREE.HSL;
            mm.color.getHSL(hsl);
            if (hsl.l > 0.55 && !mm.emissiveIntensity) {
              mm.emissive = new THREE.Color("#ffb86b");
              mm.emissiveIntensity = 0.35;
            }
          }
          mm.envMapIntensity = 0.6;
          mm.castShadow = false;
          mm.receiveShadow = false;
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat as THREE.MeshStandardMaterial);
      }
    });
    return s;
  }, [scene]);

  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);
    const maxDim = Math.max(size.x, size.z);
    const target = 400;
    const s = maxDim > 0 ? target / maxDim : 1;
    const minY = box.min.y;
    const off = new THREE.Vector3(-c.x * s, -minY * s, -c.z * s);
    const streetDetails: string[] = [];
    cloned.traverse((obj) => {
      if (obj.type === "Mesh" && /road|street|path|ground|floor|asphalt|highway/i.test(obj.name)) {
        const m = obj as THREE.Mesh;
        const mBox = new THREE.Box3().setFromObject(m);
        const mSize = new THREE.Vector3();
        const mCenter = new THREE.Vector3();
        mBox.getSize(mSize);
        mBox.getCenter(mCenter);
        const worldCenter = mCenter.clone().multiplyScalar(s).add(off);
        const worldSize = mSize.clone().multiplyScalar(s);
        streetDetails.push(`${obj.name}:\n  center=[${worldCenter.x.toFixed(1)}, ${worldCenter.y.toFixed(1)}, ${worldCenter.z.toFixed(1)}]\n  size=[${worldSize.x.toFixed(1)}, ${worldSize.y.toFixed(1)}, ${worldSize.z.toFixed(1)}]`);
      }
    });
    console.log("CITY MODEL STATS:", {
      min: box.min,
      max: box.max,
      size,
      center: c,
      scale: s,
      minY,
      scaledHeight: size.y * s,
      offset: off,
    });
    onMeshInfo(streetDetails.join("\n\n") || "No street meshes detected. All meshes:\n" + cloned.children.map((ch) => ch.name).join(", "));
    return { scale: s, offset: off };
  }, [cloned, onMeshInfo]);

  useEffect(() => {
    if (ref.current) {
      onReady(ref.current);
      const details: string[] = [];
      ref.current.updateMatrixWorld(true);
      ref.current.traverse((obj) => {
        if (obj.type === "Mesh") {
          const m = obj as THREE.Mesh;
          const box = new THREE.Box3().setFromObject(m);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          details.push(`${obj.name}: center=[${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}] size=[${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}]`);
        }
      });
      writeCoordsToServer({ data: details.join("\n") })
        .then((res) => console.log("CLIENT MESH UPLOAD SUCCESS:", res))
        .catch((err) => console.error("CLIENT MESH UPLOAD ERROR:", err));
    }
  }, [onReady, scale, offset]);

  return (
    <group ref={ref} scale={scale} position={offset}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload("/models/future_city.glb");

// ---------- Path visual ----------
function PathLine({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  return null;
}

// ---------- Waypoints ----------
function Waypoints({ points }: { points: THREE.Vector3[] }) {
  return (
    <group>
      {points.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <cylinderGeometry args={[1.4, 1.4, 0.1, 24, 1, true]} />
            <meshBasicMaterial color="#5ac8ff" toneMapped={false} transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color="#5ac8ff" intensity={3} distance={12} />
        </group>
      ))}
    </group>
  );
}

// ---------- AnimatedBillboard ----------
function CounterText({ target, position, label, suffix, start }: any) {
  const [val, setVal] = useState(0);
  const valRef = useRef(0);
  
  useFrame((_, delta) => {
    if (start && valRef.current < target) {
       valRef.current = THREE.MathUtils.damp(valRef.current, target, 2, delta);
       if (Math.abs(target - valRef.current) < 0.5) valRef.current = target;
       setVal(Math.floor(valRef.current));
    }
  });

  return (
    <group position={position}>
      <Text font="/fonts/Cairo-Bold.ttf" fontSize={2.2} color="#ffffff" anchorX="center" anchorY="bottom" fontWeight={900}>
        {val}{suffix}
      </Text>
      <Text font="/fonts/Cairo-Bold.ttf" position={[0, -0.8, 0]} fontSize={0.8} color="#ffffff" anchorX="center" anchorY="top" fontWeight={700} textAlign="center" lineHeight={1.4}>
        {label}
      </Text>
    </group>
  );
}

function AnimatedBillboard({ s, idx, p }: { s: any; idx: number; p: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [inView, setInView] = useState(false);

  const actualP = useMemo(() => {
    if (!s.offset) return p;
    return new THREE.Vector3(p.x + s.offset[0], p.y + s.offset[1], p.z + s.offset[2]);
  }, [p, s.offset]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const dist = camera.position.distanceTo(actualP);
    const maxDist = 160;
    const minDist = 90;
    let targetScale = 0.001;
    if (dist < maxDist) {
      targetScale = THREE.MathUtils.clamp(1 - (dist - minDist) / (maxDist - minDist), 0.001, 1);
    }
    const newScale = THREE.MathUtils.damp(ref.current.scale.x, targetScale, 6, delta);
    ref.current.scale.setScalar(newScale);

    if (dist < 120 && !inView) setInView(true);
  });

  if (s.isStats) {
    return (
      <Billboard position={[actualP.x, actualP.y + 11, actualP.z]} follow>
        <group ref={ref} scale={0.001}>
          {/* Background overlay covering the whole 26x12 plane */}
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[26, 12]} />
            <meshBasicMaterial color="#0f2038" />
          </mesh>
          {s.image && <Image url={s.image} position={[0, 0, 0.01]} scale={[26, 12]} transparent opacity={0.3} />}
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[26, 12]} />
            <meshBasicMaterial color="#1a3b6c" transparent opacity={0.6} />
          </mesh>
          
          <CounterText target={100} suffix=" +" label="مشروع منجز" position={[-9, 0, 0.05]} start={inView} />
          <CounterText target={50} suffix=" +" label="مشروع قيد الانتاج" position={[-3, 0, 0.05]} start={inView} />
          <CounterText target={100} suffix=" +" label="عميل" position={[3, 0, 0.05]} start={inView} />
          <CounterText target={20} suffix=" +" label="سنة خبرة" position={[9, 0, 0.05]} start={inView} />
          
          <pointLight color={s.color} intensity={5} distance={40} position={[0, 0, 2]} />
        </group>
      </Billboard>
    );
  }

  return (
    <Billboard position={[actualP.x, actualP.y + 11, actualP.z]} follow>
      <group ref={ref} scale={0.001}>
        {/* Background panel */}
        <mesh>
          <planeGeometry args={[26, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
        {/* Decorative lines */}
        <mesh position={[0, 6, 0.01]}>
          <planeGeometry args={[26.4, 0.15]} />
          <meshBasicMaterial color="#bfa15f" toneMapped={false} />
        </mesh>
        <mesh position={[0, -6, 0.01]}>
          <planeGeometry args={[26.4, 0.15]} />
          <meshBasicMaterial color="#bfa15f" toneMapped={false} />
        </mesh>
        {/* Image if present */}
        {s.image && (
          <group position={[-7.5, 0, 0.05]}>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[10.2, 10.2]} />
              <meshBasicMaterial color="#bfa15f" />
            </mesh>
            <Image url={s.image} scale={[10, 10]} />
          </group>
        )}
        {/* Text */}
        <Text font="/fonts/Cairo-Bold.ttf" position={[12, 4.5, 0.05]} fontSize={s.eyebrowSize || 0.7} color={s.eyebrowColor || "#bfa15f"} anchorX="right" anchorY="top" letterSpacing={0.05} fontWeight={700}>
          {s.eyebrow}
        </Text>
        <Text font="/fonts/Cairo-Bold.ttf" position={[12, 2.5, 0.05]} fontSize={2} color="#000000" anchorX="right" anchorY="top" maxWidth={16} lineHeight={1.2} fontWeight={900}>
          {s.title}
        </Text>
        <Text font="/fonts/Cairo-Regular.ttf" position={[12, -2.5, 0.05]} fontSize={0.8} color="#222222" anchorX="right" anchorY="top" maxWidth={16} lineHeight={1.6}>
          {s.body}
        </Text>
        <Text font="/fonts/Cairo-Bold.ttf" position={[12, -5.2, 0.05]} fontSize={0.6} color="#000000" anchorX="right" anchorY="bottom" letterSpacing={0.1}>
          {`٠${idx + 1} / ٠${SECTIONS.length}`}
        </Text>
        <pointLight color={s.color} intensity={5} distance={40} position={[0, 0, 2]} />
      </group>
    </Billboard>
  );
}

// ---------- SectionBillboards ----------
function SectionBillboards({ points }: { points: THREE.Vector3[] }) {
  return (
    <group>
      {SECTIONS.map((s, idx) => {
        const p = points[s.waypoint];
        if (!p) return null;
        return <AnimatedBillboard key={idx} s={s} idx={idx} p={p} />;
      })}
    </group>
  );
}

// ---------- Scroll-only path controller ----------
function Controller({
  curve,
  scrollRef,
  lookRef,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  scrollRef: React.MutableRefObject<number>;
  lookRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const smoothT = useRef(0);
  const smoothPos = useMemo(() => new THREE.Vector3(), []);
  const smoothLookAt = useMemo(() => new THREE.Vector3(), []);
  const HEIGHT = 8.0;

  useEffect(() => {
    const p = curve.getPointAt(0);
    camera.position.set(p.x, p.y + HEIGHT, p.z);
    smoothPos.copy(camera.position);
    const next = curve.getPointAt(0.025);
    smoothLookAt.set(next.x, p.y + HEIGHT, next.z);
    camera.lookAt(smoothLookAt);
    (camera as THREE.PerspectiveCamera).far = 1200;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, curve, smoothPos, smoothLookAt]);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.05);
    const rawT = THREE.MathUtils.clamp(scrollRef.current, 0, 0.99);
    smoothT.current = THREE.MathUtils.damp(smoothT.current, rawT, 5, clampedDelta);
    const t = smoothT.current;
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangent(t).normalize();
    const targetPos = pos.clone();
    targetPos.y += HEIGHT;
    smoothPos.x = THREE.MathUtils.damp(smoothPos.x, targetPos.x, 6, clampedDelta);
    smoothPos.y = THREE.MathUtils.damp(smoothPos.y, targetPos.y, 6, clampedDelta);
    smoothPos.z = THREE.MathUtils.damp(smoothPos.z, targetPos.z, 6, clampedDelta);
    camera.position.copy(smoothPos);
    
    // Apply yaw from lookRef (horizontal look around)
    const yawOffset = lookRef ? lookRef.current : 0;
    const lookDir = tangent.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yawOffset);
    
    const lookAhead = pos.clone().add(lookDir.multiplyScalar(25));
    lookAhead.y = pos.y + HEIGHT;
    smoothLookAt.x = THREE.MathUtils.damp(smoothLookAt.x, lookAhead.x, 5, clampedDelta);
    smoothLookAt.y = THREE.MathUtils.damp(smoothLookAt.y, lookAhead.y, 5, clampedDelta);
    smoothLookAt.z = THREE.MathUtils.damp(smoothLookAt.z, lookAhead.z, 5, clampedDelta);
    camera.lookAt(smoothLookAt);
  });

  return null;
}

// ---------- Drones ----------
function Drones() {
  const group = useRef<THREE.Group>(null);
  const drones = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        r: 40 + Math.random() * 120,
        y: 15 + Math.random() * 60,
        o: Math.random() * Math.PI * 2,
        s: 0.15 + Math.random() * 0.35,
        c: i % 2 === 0 ? "#ffffff" : "#cccccc",
      })),
    [],
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const d = drones[i];
      const t = clock.elapsedTime * d.s + d.o;
      child.position.set(Math.cos(t) * d.r, d.y + Math.sin(t * 2) * 1.5, Math.sin(t) * d.r);
    });
  });
  return (
    <group ref={group}>
      {drones.map((d, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color={d.c} emissive={d.c} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Atmosphere() {
  const { scene } = useThree();
  useEffect(() => {
    const color = new THREE.Color("#87CEEB"); // Daylight sky blue
    scene.background = color;
    scene.fog = new THREE.FogExp2(color.getHex(), 0.0015);
  }, [scene]);
  return null;
}

export default function CityScene({
  scrollRef,
  lookRef,
}: {
  scrollRef: React.MutableRefObject<number>;
  lookRef?: React.MutableRefObject<number>;
}) {
  const cityRef = useRef<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityReady, setCityReady] = useState(false);
  const [meshInfo, setMeshInfo] = useState<string>("");

  useEffect(() => {
    runParserOnServer()
      .then((res) => console.log("SERVER GLB PARSER SUCCESS:", res))
      .catch((err) => console.error("SERVER GLB PARSER ERROR:", err));
  }, []);

  const curve = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const start = new THREE.Vector3(...WAYPOINTS[i]);
      const end = new THREE.Vector3(...WAYPOINTS[i + 1]);
      path.add(new THREE.LineCurve3(start, end));
    }
    return path;
  }, []);
  const waypointVecs = useMemo(() => WAYPOINTS.map((p) => new THREE.Vector3(...p)), []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loading && <LoadingSpinner />}
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 65, near: 0.5, far: 1200, position: [0, 2.5, 90] }}
        onCreated={() => setLoading(false)}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Atmosphere />
        <ambientLight intensity={0.9} color="#7a9bd8" />
        <directionalLight position={[60, 100, 30]} intensity={1.8} color="#ffb070" />
        <hemisphereLight args={["#ffb070", "#0a0f24", 0.7]} />
        <Suspense fallback={null}>
          <City
            onReady={(g) => {
              cityRef.current = g;
              setCityReady(true);
            }}
            onMeshInfo={setMeshInfo}
          />
          <Drones />
          <Sparkles count={120} scale={[400, 120, 400]} size={2} speed={0.2} opacity={0.6} color="#ffd08a" />
          {/* Stars disabled for daylight */}
          <Environment preset="night" />
          <Preload all />
        </Suspense>
        {cityReady && <PathLine curve={curve} />}
        {cityReady && <Waypoints points={waypointVecs} />}
        {cityReady && <SectionBillboards points={waypointVecs} />}
        <Controller curve={curve} scrollRef={scrollRef} lookRef={lookRef!} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.4} luminanceSmoothing={0.1} mipmapBlur />
          <Vignette eskil={false} offset={0.4} darkness={0.4} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/future_city.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
