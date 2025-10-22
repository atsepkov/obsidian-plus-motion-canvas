import {Line, Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
  const logoGroup = createRef<Layout>();
  const topFace = createRef<Line>();
  const leftFace = createRef<Line>();
  const rightFace = createRef<Line>();
  const wordmark = createRef<Txt>();
  const mottoRef = createRef<Txt>();
  const mottoSignal = createSignal('');

  view.add(
    <Layout layout direction={'column'} gap={32} alignItems={'center'}>
      <Layout
        ref={logoGroup}
        layout
        direction={'row'}
        gap={28}
        alignItems={'center'}
        opacity={0}
        scale={1.35}
        y={80}
      >
        <Rect width={140} height={140}>
          <Line
            ref={leftFace}
            points={[
              [-48, -18],
              [0, 8],
              [0, 74],
              [-48, 48],
            ]}
            closed
            fill={'#111827'}
            stroke={'#0f172a'}
            lineWidth={6}
            opacity={0}
          />
          <Line
            ref={rightFace}
            points={[
              [0, 8],
              [48, -18],
              [48, 48],
              [0, 74],
            ]}
            closed
            fill={'#1f2937'}
            stroke={'#0f172a'}
            lineWidth={6}
            opacity={0}
          />
          <Line
            ref={topFace}
            points={[
              [-48, -18],
              [0, -48],
              [48, -18],
              [0, 8],
            ]}
            closed
            fill={'#334155'}
            stroke={'#0f172a'}
            lineWidth={6}
            opacity={0}
          />
        </Rect>
        <Txt
          ref={wordmark}
          text={'Obsidian+'}
          fontSize={64}
          fontWeight={600}
          fill={'#e2e8f0'}
          fontFamily={'Inter, "Segoe UI", sans-serif'}
          opacity={0}
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
    logoGroup().opacity(1, 0.6, easeInOutCubic),
    logoGroup().scale(1, 0.6, easeOutBack),
    logoGroup().y(0, 0.6, easeOutCubic),
  );

  yield* sequence(
    0.08,
    topFace().opacity(1, 0.18, easeInOutCubic),
    leftFace().opacity(1, 0.18, easeInOutCubic),
    rightFace().opacity(1, 0.18, easeInOutCubic),
  );

  yield* wordmark().opacity(1, 0.2);

  yield* waitFor(0.2);

  yield* mottoRef().opacity(1, 0.1);

  for (let i = 1; i <= mottoText.length; i++) {
    mottoSignal(mottoText.slice(0, i));
    yield* waitFor(0.018);
  }
});
