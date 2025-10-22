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
            width={150}
            height={34}
            fill={'#0f172a'}
            radius={34}
            y={112}
            opacity={0}
          />
          <Line
            ref={leftFace}
            points={[
              [-66, -32],
              [0, 0],
              [0, 94],
              [-66, 60],
            ]}
            closed
            fill={'#6366f1'}
            stroke={'#312e81'}
            lineWidth={8}
            lineJoin={'round'}
            opacity={0}
          />
          <Line
            ref={rightFace}
            points={[
              [0, 0],
              [66, -32],
              [66, 60],
              [0, 94],
            ]}
            closed
            fill={'#4f46e5'}
            stroke={'#1e1b4b'}
            lineWidth={8}
            lineJoin={'round'}
            opacity={0}
          />
          <Line
            ref={topFace}
            points={[
              [-66, -32],
              [0, -96],
              [66, -32],
              [0, 0],
            ]}
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
