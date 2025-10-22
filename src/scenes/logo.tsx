import {Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  sequence,
  waitFor,
} from '@motion-canvas/core';

const mottoText = 'From Notes to Systems — Instantly';

const cubeSize = 132;
const cos30 = Math.sqrt(3) / 2;
const sin30 = 0.5;

const isoProject = ([x, y, z]: [number, number, number]): [number, number] => [
  (x - y) * cos30,
  (x + y) * sin30 - z,
];

const center3d: [number, number, number] = [
  cubeSize / 2,
  cubeSize / 2,
  cubeSize / 2,
];

const center2d: [number, number] = isoProject(center3d);

const shiftToCenter = (point: [number, number]): [number, number] => [
  point[0] - center2d[0],
  point[1] - center2d[1],
];

const cubeFaces: Record<'top' | 'right' | 'left', [number, number][]> = {
  top: [
    shiftToCenter(isoProject([0, 0, cubeSize])),
    shiftToCenter(isoProject([cubeSize, 0, cubeSize])),
    shiftToCenter(isoProject([cubeSize, cubeSize, cubeSize])),
    shiftToCenter(isoProject([0, cubeSize, cubeSize])),
  ],
  right: [
    shiftToCenter(isoProject([cubeSize, 0, cubeSize])),
    shiftToCenter(isoProject([cubeSize, cubeSize, cubeSize])),
    shiftToCenter(isoProject([cubeSize, cubeSize, 0])),
    shiftToCenter(isoProject([cubeSize, 0, 0])),
  ],
  left: [
    shiftToCenter(isoProject([0, cubeSize, cubeSize])),
    shiftToCenter(isoProject([0, 0, cubeSize])),
    shiftToCenter(isoProject([0, 0, 0])),
    shiftToCenter(isoProject([0, cubeSize, 0])),
  ],
};

export default makeScene2D(function* (view) {
  view.fill('#000000');

  const logoGroup = createRef<Layout>();
  const cube = createRef<Layout>();
  const topFace = createRef<Line>();
  const leftFace = createRef<Line>();
  const rightFace = createRef<Line>();
  const shadow = createRef<Rect>();
  const wordmark = createRef<Txt>();
  const mottoRef = createRef<Txt>();
  const mottoSignal = createSignal('');

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
        opacity={0}
        scale={1.25}
      >
        <Layout ref={cube} x={-480} rotation={-270} y={32}>
          <Rect
            ref={shadow}
            width={190}
            height={38}
            fill={'#0f172a'}
            radius={38}
            y={118}
            opacity={0}
          />
          <Line
            ref={leftFace}
            points={cubeFaces.left}
            closed
            fill={'#6366f1'}
            stroke={'#312e81'}
            lineWidth={8}
            lineJoin={'round'}
            opacity={0}
          />
          <Line
            ref={rightFace}
            points={cubeFaces.right}
            closed
            fill={'#4f46e5'}
            stroke={'#1e1b4b'}
            lineWidth={8}
            lineJoin={'round'}
            opacity={0}
          />
          <Line
            ref={topFace}
            points={cubeFaces.top}
            closed
            fill={'#818cf8'}
            stroke={'#312e81'}
            lineWidth={8}
            lineJoin={'round'}
            opacity={0}
          />
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
    logoGroup().opacity(1, 0.3, easeInOutCubic),
    logoGroup().scale(1, 0.3, easeOutBack),
  );

  yield* all(
    cube().x(0, 0.48, easeOutCubic),
    cube().rotation(-18, 0.48, easeInOutCubic),
  );

  yield* cube().rotation(0, 0.12, easeOutBack);

  yield* all(
    sequence(
      0.04,
      topFace().opacity(1, 0.14, easeInOutCubic),
      rightFace().opacity(1, 0.14, easeInOutCubic),
      leftFace().opacity(1, 0.14, easeInOutCubic),
    ),
    cube().y(-28, 0.14, easeOutCubic),
    shadow().opacity(0.55, 0.14, easeOutCubic),
  );

  yield* all(
    cube().y(12, 0.1, easeInOutCubic),
    shadow().opacity(0.7, 0.1, easeInOutCubic),
  );
  yield* all(
    cube().y(0, 0.08, easeOutBack),
    shadow().opacity(0.65, 0.08, easeOutBack),
  );

  yield* all(
    wordmark().opacity(1, 0.18),
    wordmark().x(0, 0.18, easeOutCubic),
  );

  yield* waitFor(0.08);

  yield* mottoRef().opacity(1, 0.1);

  for (let i = 1; i <= mottoText.length; i++) {
    mottoSignal(mottoText.slice(0, i));
    yield* waitFor(0.01);
  }
});
