import {
  Camera,
  Img,
  Layout,
  Line,
  Path,
  Rect,
  Txt,
  makeScene2D,
} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  waitFor,
} from '@motion-canvas/core';

import {
  buildDocumentNodes,
  checkboxFrameSize,
  defaultLayoutConfig,
  defaultTagColor,
  parseDocument,
} from './shared/checklist';

const stageWidth = 1920;
const stageHeight = 1080;

const backgroundWidth = 3600;
const backgroundHeight = 2400;

const taskCardWidth = 760;
const taskCardHeight = 420;
const taskCardPadding = 48;

const initialLines = ['- [ ] #application renter@gmail.com'];

const driveIconSize = 220;
const emailIconSize = {width: 220, height: 160};

const googleDriveIconUrl =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/512px-Google_Drive_icon_%282020%29.svg.png';

const apexPositions = {
  task: [-900, 0] as [number, number],
  drive: [940, -720] as [number, number],
  email: [940, 720] as [number, number],
};

const arrowThickness = 8;
const arrowInset = 150;

const insetConnection = (
  start: [number, number],
  end: [number, number],
  inset: number,
) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return {start, end};
  }

  const maxInset = Math.max(0, Math.min(inset, length / 2));
  const offsetX = (dx / length) * maxInset;
  const offsetY = (dy / length) * maxInset;

  return {
    start: [start[0] + offsetX, start[1] + offsetY] as [number, number],
    end: [end[0] - offsetX, end[1] - offsetY] as [number, number],
  } as const;
};

const arrowConnections = {
  taskToDrive: insetConnection(apexPositions.task, apexPositions.drive, arrowInset),
  driveToEmail: insetConnection(apexPositions.drive, apexPositions.email, arrowInset),
  emailToTask: insetConnection(apexPositions.email, apexPositions.task, arrowInset),
} as const;

const initialZoom = 1.36;

export default makeScene2D(function* (view) {
  const camera = createRef<Camera>();
  const taskCardRef = createRef<Layout>();
  const taskDocumentRef = createRef<Layout>();
  const driveGroupRef = createRef<Layout>();
  const emailGroupRef = createRef<Layout>();

  let currentLines = [...initialLines];
  let parsedDocument = parseDocument(currentLines);
  let documentVersion = 0;

  const tagColor = createSignal(
    parsedDocument.lines[0]?.tagColor ?? defaultTagColor,
  );

  const arrowTaskToDriveProgress = createSignal(0);
  const arrowTaskToDriveOpacity = createSignal(0);

  const arrowDriveToEmailProgress = createSignal(0);
  const arrowDriveToEmailOpacity = createSignal(0);

  const arrowEmailToTaskProgress = createSignal(0);
  const arrowEmailToTaskOpacity = createSignal(0);

  const driveCaptionOpacity = createSignal(0);
  const emailCaptionOpacity = createSignal(0);

  const cursorScale = createSignal(1);
  const cursorOpacity = createSignal(1);
  const cursorX = createSignal(apexPositions.task[0] - 260);
  const cursorY = createSignal(apexPositions.task[1] - 200);

  const cursorPathData =
    'M 5.65625 2.09375 C 5.550781 2.070313 5.4375 2.082031 5.34375 2.117188 C 5.160156 2.195313 5 2.402344 5 2.632813 L 5 13.421875 L 7.789063 11.613281 L 9.101563 14.171875 L 11.546875 12.921875 L 10.339844 10.578125 L 13.472656 9.765625 L 12.855469 9.148438 L 5.945313 2.242188 C 5.867188 2.160156 5.761719 2.113281 5.65625 2.09375 Z M 6 3.707031 L 11.527344 9.234375 L 8.878906 9.921875 L 10.199219 12.484375 L 9.539063 12.828125 L 8.171875 10.171875 L 6 11.578125 Z';
  const cursorBaseScale = 6;
  const cursorTipOffset = {
    x: 5 * cursorBaseScale,
    y: 2.081558289 * cursorBaseScale,
  } as const;

  const nextDocumentKeyPrefix = () =>
    `external-api-document-${documentVersion++}`;

  const rebuildDocument = () => {
    parsedDocument = parseDocument(currentLines);
    tagColor(parsedDocument.lines[0]?.tagColor ?? defaultTagColor);
    const documentNode = taskDocumentRef();
    if (!documentNode) {
      return;
    }
    const keyPrefix = nextDocumentKeyPrefix();
    documentNode.removeChildren();
    documentNode.add(
      buildDocumentNodes(parsedDocument, {keyPrefix}),
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
      <Camera ref={camera} position={apexPositions.task} zoom={initialZoom}>
        <Rect
          layout={false}
          width={backgroundWidth}
          height={backgroundHeight}
          fill={'#0f1218'}
          radius={72}
        />

        <Rect
          layout={false}
          width={taskCardWidth}
          height={taskCardHeight}
          fill={'#101724'}
          radius={48}
          shadowColor={'#00000088'}
          shadowBlur={72}
          position={apexPositions.task}
        />

        <Layout
          ref={taskCardRef}
          layout
          direction={'column'}
          alignItems={'start'}
          justifyContent={'start'}
          padding={taskCardPadding}
          gap={defaultLayoutConfig.columnGap}
          width={taskCardWidth}
          position={apexPositions.task}
        >
          <Layout
            ref={taskDocumentRef}
            layout
            direction={'column'}
            alignItems={'start'}
            justifyContent={'start'}
            gap={defaultLayoutConfig.columnGap}
            width={taskCardWidth - taskCardPadding * 2}
          />
        </Layout>

        <Layout
          ref={driveGroupRef}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={32}
          position={apexPositions.drive}
        >
          <Rect
            layout
            justifyContent={'center'}
            alignItems={'center'}
            width={driveIconSize}
            height={driveIconSize}
            radius={36}
            fill={'#0c1627'}
            stroke={'#1e293b'}
            lineWidth={5}
          >
            <Img
              layout={false}
              width={driveIconSize - 48}
              height={driveIconSize - 48}
              src={googleDriveIconUrl}
              smoothing
            />
          </Rect>
          <Txt
            text={'new rental application from template'}
            fontFamily={'Inter, sans-serif'}
            fontSize={30}
            fill={'#d1dcff'}
            opacity={driveCaptionOpacity}
          />
        </Layout>

        <Layout
          ref={emailGroupRef}
          layout
          direction={'column'}
          alignItems={'center'}
          gap={32}
          position={apexPositions.email}
        >
          <Rect
            layout
            justifyContent={'center'}
            alignItems={'center'}
            width={emailIconSize.width}
            height={emailIconSize.height}
            radius={36}
            fill={'#0c1627'}
            stroke={'#334155'}
            lineWidth={5}
          >
            <Rect
              layout={false}
              width={emailIconSize.width - 48}
              height={emailIconSize.height - 48}
              radius={24}
              stroke={'#38bdf8'}
              lineWidth={6}
            />
            <Line
              layout={false}
              points={[
                [-(emailIconSize.width - 64) / 2, -24],
                [0, 20],
                [(emailIconSize.width - 64) / 2, -24],
              ]}
              stroke={'#38bdf8'}
              lineWidth={6}
              lineJoin={'round'}
            />
          </Rect>
          <Txt
            text={'rental applicant'}
            fontFamily={'Inter, sans-serif'}
            fontSize={30}
            fill={'#d1dcff'}
            opacity={emailCaptionOpacity}
          />
        </Layout>

        <Line
          layout={false}
          points={[
            arrowConnections.taskToDrive.start,
            arrowConnections.taskToDrive.end,
          ]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          lineCap={'round'}
          end={arrowTaskToDriveProgress}
          opacity={arrowTaskToDriveOpacity}
          endArrow
        />

        <Line
          layout={false}
          points={[
            arrowConnections.driveToEmail.start,
            arrowConnections.driveToEmail.end,
          ]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          lineCap={'round'}
          end={arrowDriveToEmailProgress}
          opacity={arrowDriveToEmailOpacity}
          endArrow
        />

        <Line
          layout={false}
          points={[
            arrowConnections.emailToTask.start,
            arrowConnections.emailToTask.end,
          ]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          lineCap={'round'}
          end={arrowEmailToTaskProgress}
          opacity={arrowEmailToTaskOpacity}
          endArrow
        />

        <Layout
          layout={false}
          position={() => [
            cursorX() - cursorTipOffset.x * cursorScale(),
            cursorY() - cursorTipOffset.y * cursorScale(),
          ]}
          scale={cursorScale}
          opacity={cursorOpacity}
        >
          <Path
            layout={false}
            data={cursorPathData}
            scale={cursorBaseScale}
            fill={'#f8fafc'}
            stroke={'#0f172a'}
            lineWidth={1.4}
            lineJoin={'round'}
          />
        </Layout>
      </Camera>
    </Rect>,
  );

  while (!taskDocumentRef()) {
    yield;
  }

  rebuildDocument();

  yield* waitFor(0.6);

  const documentNode = taskDocumentRef();
  let markerCenterX = cursorX();
  let markerCenterY = cursorY();
  if (documentNode) {
    const firstLine = documentNode.children()[0] as Rect | undefined;
    if (firstLine) {
      const lineChildren = firstLine.children();
      const markerColumn = lineChildren[0] as Rect | undefined;
      if (markerColumn) {
        const markerPosition = markerColumn.absolutePosition();
        markerCenterX = markerPosition.x + checkboxFrameSize / 2 - 6;
        markerCenterY = markerPosition.y + checkboxFrameSize / 2 - 6;
      }
    }
  }

  yield* all(
    cursorX(markerCenterX, 0.6, easeInOutCubic),
    cursorY(markerCenterY, 0.6, easeInOutCubic),
  );

  yield* cursorScale(0.85, 0.12, easeInOutCubic);
  yield* cursorScale(1, 0.16, easeInOutCubic);

  currentLines[0] = currentLines[0].replace('- [ ]', '- [/]');
  rebuildDocument();

  yield* cursorOpacity(0, 0.24, easeInOutCubic);

  yield* waitFor(0.2);

  arrowTaskToDriveProgress(0);
  yield* all(
    arrowTaskToDriveOpacity(1, 0.1, easeInOutCubic),
    arrowTaskToDriveProgress(1, 0.9, easeInOutCubic),
    camera().centerOn(driveGroupRef(), 0.9, easeInOutCubic),
    camera().zoom(initialZoom * 0.98, 0.9, easeInOutCubic),
  );
  yield* arrowTaskToDriveOpacity(0, 0.12, easeInOutCubic);
  arrowTaskToDriveProgress(0);

  yield* driveCaptionOpacity(1, 0.4, easeInOutCubic);

  yield* waitFor(0.3);

  arrowDriveToEmailProgress(0);
  yield* all(
    arrowDriveToEmailOpacity(1, 0.1, easeInOutCubic),
    arrowDriveToEmailProgress(1, 0.9, easeInOutCubic),
    camera().centerOn(emailGroupRef(), 0.9, easeInOutCubic),
    camera().zoom(initialZoom * 0.96, 0.9, easeInOutCubic),
    emailCaptionOpacity(1, 0.6, easeInOutCubic),
  );
  yield* arrowDriveToEmailOpacity(0, 0.12, easeInOutCubic);
  arrowDriveToEmailProgress(0);

  yield* waitFor(0.4);

  arrowEmailToTaskProgress(0);
  yield* all(
    arrowEmailToTaskOpacity(1, 0.1, easeInOutCubic),
    arrowEmailToTaskProgress(1, 1.0, easeInOutCubic),
    camera().centerOn(taskCardRef(), 1.0, easeInOutCubic),
    camera().zoom(initialZoom, 1.0, easeInOutCubic),
  );
  yield* arrowEmailToTaskOpacity(0, 0.12, easeInOutCubic);
  arrowEmailToTaskProgress(0);

  currentLines[0] = currentLines[0].replace(/- \[[ xX/\-!\?]\]/, '- [x]');
  if (!currentLines[0].includes('✅')) {
    currentLines[0] = `${currentLines[0]} ✅ 2025-10-22`;
  }
  if (currentLines.length === 1) {
    currentLines.push(
      '    - [rental application](https://docs.google.com/document/d/rental-application)',
    );
  }
  rebuildDocument();

  yield* waitFor(1.4);
});
