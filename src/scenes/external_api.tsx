import {Camera, Layout, Polygon, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';

import {
  buildDocumentNodes,
  checkboxFrameSize,
  defaultLayoutConfig,
  parseDocument,
} from './shared/checklist';

const stageWidth = 1920;
const stageHeight = 1080;

const backgroundWidth = 3200;
const backgroundHeight = 2000;

const taskCardWidth = 760;
const taskCardPadding = 48;
const documentWidth = taskCardWidth - taskCardPadding * 2;

const initialLines = ['- [ ] #application renter@gmail.com'];

const positions = {
  task: [-640, 0] as [number, number],
  drive: [520, -360] as [number, number],
  email: [520, 360] as [number, number],
};

const cameraZooms = {
  task: 1.28,
  drive: 1.06,
  email: 1.06,
};

const cursorStart: [number, number] = [positions.task[0] - 260, positions.task[1] - 140];
const cursorTarget: [number, number] = [
  positions.task[0] - documentWidth / 2 + checkboxFrameSize / 2 + 4,
  positions.task[1] - 6,
];

const drivePlaceholderSize = 260;
const emailIconSize = 220;

export default makeScene2D(function* (view) {
  const cameraRef = createRef<Camera>();
  const taskCardRef = createRef<Rect>();
  const documentRef = createRef<Layout>();
  const driveGroupRef = createRef<Layout>();
  const emailGroupRef = createRef<Layout>();
  const cursorRef = createRef<Layout>();
  const driveCaptionRef = createRef<Txt>();
  const emailCaptionRef = createRef<Txt>();

  let currentLines = [...initialLines];
  let parsedDocument = parseDocument(currentLines);
  let documentVersion = 0;

  const nextDocumentKeyPrefix = () => `external-api-document-${documentVersion++}`;

  const rebuildDocument = () => {
    parsedDocument = parseDocument(currentLines);
    const documentNode = documentRef();
    documentNode.removeChildren();
    documentNode.add(
      buildDocumentNodes(parsedDocument, {
        keyPrefix: nextDocumentKeyPrefix(),
        checkboxMarginRight: 16,
      }),
    );
  };

  view.add(
    <Rect
      layout
      width={stageWidth}
      height={stageHeight}
      fill={'#05070c'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Camera ref={cameraRef} position={positions.task} zoom={cameraZooms.task}>
        <Rect
          layout={false}
          width={backgroundWidth}
          height={backgroundHeight}
          fill={'#0f1218'}
          radius={64}
        />

        <Rect
          ref={taskCardRef}
          layout
          direction={'column'}
          alignItems={'start'}
          justifyContent={'center'}
          padding={taskCardPadding}
          gap={defaultLayoutConfig.columnGap}
          width={taskCardWidth}
          fill={'#101724'}
          radius={48}
          shadowColor={'#00000080'}
          shadowBlur={72}
          position={positions.task}
        >
          <Layout
            ref={documentRef}
            layout
            direction={'column'}
            alignItems={'start'}
            gap={defaultLayoutConfig.columnGap}
            width={documentWidth}
          >
            {buildDocumentNodes(parsedDocument, {
              keyPrefix: nextDocumentKeyPrefix(),
              checkboxMarginRight: 16,
            })}
          </Layout>
        </Rect>

        <Layout
          ref={driveGroupRef}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={28}
          position={positions.drive}
        >
          {/* Replace the contents of this placeholder with an <Img src={...} /> when the final drive artwork is available. */}
          <Rect
            layout
            justifyContent={'center'}
            alignItems={'center'}
            width={drivePlaceholderSize}
            height={drivePlaceholderSize}
            radius={32}
            fill={'#101b2d'}
            stroke={'#1f2a44'}
            lineWidth={6}
          >
            <Txt
              text={'Drive preview\nplaceholder'}
              fontFamily={'Inter, sans-serif'}
              fontSize={28}
              lineHeight={36}
              fill={'#94a3b8'}
              textAlign={'center'}
            />
          </Rect>
          <Txt
            ref={driveCaptionRef}
            text={'Rental application is getting created'}
            fontFamily={'Inter, sans-serif'}
            fontSize={32}
            fill={'#d7deeb'}
            opacity={0}
          />
        </Layout>

        <Layout
          ref={emailGroupRef}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={28}
          position={positions.email}
        >
          <Rect
            layout
            justifyContent={'center'}
            alignItems={'center'}
            width={emailIconSize}
            height={emailIconSize}
            radius={32}
            fill={'#101b2d'}
            stroke={'#1f2a44'}
            lineWidth={6}
          >
            <Polygon
              points={[[-60, -20], [0, 26], [60, -20]]}
              stroke={'#39a0ff'}
              fill={'#0f172a'}
              lineWidth={8}
              closed
            />
            <Rect
              layout={false}
              width={140}
              height={80}
              radius={20}
              stroke={'#39a0ff'}
              lineWidth={8}
              fill={'#0f172a'}
            />
          </Rect>
          <Txt
            ref={emailCaptionRef}
            text={"Tenant's mailbox"}
            fontFamily={'Inter, sans-serif'}
            fontSize={32}
            fill={'#d7deeb'}
            opacity={0}
          />
        </Layout>

        <Layout
          ref={cursorRef}
          layout
          position={cursorStart}
          opacity={0}
          scale={1}
        >
          <Polygon
            points={[[0, 0], [32, 80], [0, 60], [-32, 80]]}
            fill={'#f8fafc'}
            stroke={'#0f172a'}
            lineWidth={4}
            closed
          />
        </Layout>
      </Camera>
    </Rect>,
  );

  yield* waitFor(0.6);

  yield* cursorRef().opacity(1, 0.24);
  yield* cursorRef().position(cursorTarget, 0.8, easeInOutCubic);
  yield* cursorRef().scale(0.88, 0.1, easeInOutCubic);
  yield* cursorRef().scale(1.0, 0.14, easeInOutCubic);

  currentLines[0] = currentLines[0].replace(/- \[[^\]]\]/, '- [/]');
  rebuildDocument();

  yield* waitFor(0.25);
  yield* cursorRef().opacity(0, 0.3);

  yield* all(
    cameraRef().centerOn(driveGroupRef(), 1.0, easeInOutCubic),
    cameraRef().zoom(cameraZooms.drive, 1.0, easeInOutCubic),
  );

  yield* driveCaptionRef().opacity(1, 0.6);
  yield* waitFor(0.4);

  yield* all(
    cameraRef().centerOn(emailGroupRef(), 0.9, easeInOutCubic),
    cameraRef().zoom(cameraZooms.email, 0.9, easeInOutCubic),
  );

  yield* emailCaptionRef().opacity(1, 0.6);
  yield* waitFor(0.4);

  yield* all(
    cameraRef().centerOn(taskCardRef(), 1.1, easeInOutCubic),
    cameraRef().zoom(cameraZooms.task, 1.1, easeInOutCubic),
  );

  currentLines[0] = currentLines[0].replace(/- \[[^\]]\]/, '- [x]');
  rebuildDocument();

  yield* waitFor(1.2);
});
