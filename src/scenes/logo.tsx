import {Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  PossibleVector2,
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';

const mottoText = 'From Notes to Systems — Instantly';

type Vec3 = [number, number, number];

const cubeEdge = 120;
const halfEdge = cubeEdge / 2;
const projectionScale = 1;

const baseVertices: Vec3[] = [
  [-halfEdge, -halfEdge, halfEdge],
  [halfEdge, -halfEdge, halfEdge],
  [halfEdge, halfEdge, halfEdge],
  [-halfEdge, halfEdge, halfEdge],
  [-halfEdge, -halfEdge, -halfEdge],
  [halfEdge, -halfEdge, -halfEdge],
  [halfEdge, halfEdge, -halfEdge],
  [-halfEdge, halfEdge, -halfEdge],
];

type FaceName = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';

interface FaceConfig {
  name: FaceName;
  indices: [number, number, number, number];
  fill: string;
  stroke: string;
}

const faceConfigs: FaceConfig[] = [
  {name: 'front', indices: [3, 2, 1, 0], fill: '#4f46e5', stroke: '#1e1b4b'},
  {name: 'back', indices: [7, 6, 5, 4], fill: '#1d1b4a', stroke: '#111035'},
  {name: 'top', indices: [7, 6, 2, 3], fill: '#818cf8', stroke: '#312e81'},
  {name: 'bottom', indices: [0, 1, 5, 4], fill: '#1e1b4b', stroke: '#0b0a23'},
  {name: 'left', indices: [7, 3, 0, 4], fill: '#4338ca', stroke: '#1c1965'},
  {name: 'right', indices: [2, 6, 5, 1], fill: '#6366f1', stroke: '#2c2a7b'},
];

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const rotatePoint = ([x, y, z]: Vec3, rx: number, ry: number, rz: number): Vec3 => {
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x1 = x * cosY + z * sinY;
  const y1 = y;
  const z1 = -x * sinY + z * cosY;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const x2 = x1;
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const x3 = x2 * cosZ - y2 * sinZ;
  const y3 = x2 * sinZ + y2 * cosZ;

  return [x3, y3, z2];
};

const projectPoint = ([x, y]: Vec3): PossibleVector2 => [
  x * projectionScale,
  -y * projectionScale,
];

const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const magnitude = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

const normalize = (v: Vec3): Vec3 => {
  const length = magnitude(v);
  return length === 0 ? [0, 0, 0] : [v[0] / length, v[1] / length, v[2] / length];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const parsed = parseInt(normalized, 16);
  return [
    (parsed >> 16) & 0xff,
    (parsed >> 8) & 0xff,
    parsed & 0xff,
  ];
};

const rgbToHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b]
    .map((component) => component.toString(16).padStart(2, '0'))
    .join('')}`;

const shadeColor = (base: string, intensity: number) => {
  const rgb = hexToRgb(base);
  const clamped = clamp(intensity, -1, 1);

  if (clamped >= 0) {
    const factor = clamped * 0.55;
    const shaded: [number, number, number] = [
      Math.round(rgb[0] + (255 - rgb[0]) * factor),
      Math.round(rgb[1] + (255 - rgb[1]) * factor),
      Math.round(rgb[2] + (255 - rgb[2]) * factor),
    ];
    return rgbToHex(shaded);
  }

  const factor = -clamped * 0.6;
  const shaded: [number, number, number] = [
    Math.round(rgb[0] * (1 - factor)),
    Math.round(rgb[1] * (1 - factor)),
    Math.round(rgb[2] * (1 - factor)),
  ];
  return rgbToHex(shaded);
};

const lightDirection = normalize([-0.45, -0.7, 0.8]);

const faceGeometry = (
  face: FaceConfig,
  rx: number,
  ry: number,
  rz: number,
): {
  points: PossibleVector2[];
  normal: Vec3;
  depth: number;
} => {
  const rotated = baseVertices.map((vertex) => rotatePoint(vertex, rx, ry, rz));
  const points = face.indices.map((index) => projectPoint(rotated[index]));
  const [i0, i1, i2] = face.indices;
  const normal = cross(
    subtract(rotated[i1], rotated[i0]),
    subtract(rotated[i2], rotated[i0]),
  );
  const depth =
    face.indices.reduce((sum, idx) => sum + rotated[idx][2], 0) / face.indices.length;

  return {points, normal, depth};
};

export default makeScene2D(function* (view) {
  view.fill('#000000');

  const logoGroup = createRef<Layout>();
  const shadowRect = createRef<Rect>();
  const wordmark = createRef<Txt>();
  const mottoRef = createRef<Txt>();

  const mottoSignal = createSignal('');
  const cubeOffsetX = createSignal(-460);
  const cubeOffsetY = createSignal(32);
  const rotationX = createSignal(degToRad(-65));
  const rotationY = createSignal(degToRad(140));
  const rotationZ = createSignal(degToRad(-40));
  const faceOpacity = createSignal(0);
  const shadowOpacity = createSignal(0);

  const finalRotationX = degToRad(-35.264);
  const finalRotationY = degToRad(45);
  const finalRotationZ = degToRad(0);

  view.add(
    <Layout
      layout
      direction={'column'}
      gap={36}
      alignItems={'center'}
      justifyContent={'center'}
      width={'100%'}
      height={'100%'}
    >
      <Layout
        ref={logoGroup}
        layout
        direction={'row'}
        gap={28}
        alignItems={'center'}
        justifyContent={'center'}
        opacity={0}
        scale={1.24}
      >
        <Layout x={() => cubeOffsetX()} y={() => cubeOffsetY()}>
          <Rect
            ref={shadowRect}
            width={200}
            height={40}
            fill={'#0f172a'}
            radius={40}
            y={128}
            opacity={() => shadowOpacity()}
          />
          {faceConfigs.map((face) => (
            <Line
              key={face.name}
              points={() => {
                const geometry = faceGeometry(
                  face,
                  rotationX(),
                  rotationY(),
                  rotationZ(),
                );
                return geometry.points;
              }}
              closed
              fill={() => {
                const geometry = faceGeometry(
                  face,
                  rotationX(),
                  rotationY(),
                  rotationZ(),
                );
                const normal = normalize(geometry.normal);
                const intensity = dot(normal, lightDirection);
                return shadeColor(face.fill, intensity);
              }}
              stroke={face.stroke}
              lineWidth={8}
              lineJoin={'round'}
              opacity={() => {
                const geometry = faceGeometry(
                  face,
                  rotationX(),
                  rotationY(),
                  rotationZ(),
                );
                const visible = geometry.normal[2] > 0.01;
                return visible ? faceOpacity() : 0;
              }}
              zIndex={() => {
                const geometry = faceGeometry(
                  face,
                  rotationX(),
                  rotationY(),
                  rotationZ(),
                );
                return Math.round(geometry.depth * 10);
              }}
            />
          ))}
        </Layout>
        <Txt
          ref={wordmark}
          text={'Obsidian+'}
          fontSize={64}
          fontWeight={600}
          fill={'#f8fafc'}
          fontFamily={'Inter, "Segoe UI", sans-serif'}
          opacity={0}
          x={28}
        />
      </Layout>
      <Txt
        ref={mottoRef}
        text={() => mottoSignal()}
        fontSize={36}
        fill={'#cbd5f5'}
        fontFamily={'Inter, "Segoe UI", sans-serif'}
        opacity={0}
      />
    </Layout>,
  );

  yield* all(
    logoGroup().opacity(1, 0.28, easeInOutCubic),
    logoGroup().scale(1, 0.28, easeOutBack),
  );

  yield* all(
    cubeOffsetX(0, 0.54, easeOutCubic),
    cubeOffsetY(0, 0.54, easeOutBack),
    rotationY(finalRotationY, 0.54, easeOutCubic),
    rotationX(finalRotationX, 0.54, easeOutBack),
    rotationZ(finalRotationZ, 0.54, easeInOutCubic),
    faceOpacity(1, 0.38, easeInOutCubic),
    shadowOpacity(0.65, 0.38, easeOutCubic),
  );

  yield* all(
    cubeOffsetY(-26, 0.12, easeOutCubic),
    shadowRect().scale(0.9, 0.12, easeInOutCubic),
  );

  yield* all(
    cubeOffsetY(8, 0.12, easeInOutCubic),
    shadowRect().scale(1.05, 0.12, easeInOutCubic),
    shadowOpacity(0.72, 0.12, easeInOutCubic),
  );

  yield* all(
    cubeOffsetY(0, 0.1, easeOutBack),
    shadowRect().scale(1, 0.1, easeOutBack),
    shadowOpacity(0.68, 0.1, easeOutBack),
  );

  yield* all(
    wordmark().opacity(1, 0.18),
    wordmark().x(0, 0.18, easeOutCubic),
  );

  yield* waitFor(0.08);

  yield* mottoRef().opacity(1, 0.12);

  for (let i = 1; i <= mottoText.length; i++) {
    mottoSignal(mottoText.slice(0, i));
    yield* waitFor(0.01);
  }
});
