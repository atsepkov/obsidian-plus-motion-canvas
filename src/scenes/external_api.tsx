import {Camera, Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
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
const taskCardPadding = 48;

const initialLines = ['- [ ] #application renter@gmail.com'];

const driveIconSize = 220;
const emailIconSize = {width: 220, height: 160};

const apexPositions = {
  task: [-900, 0] as [number, number],
  drive: [940, -720] as [number, number],
  email: [940, 720] as [number, number],
};

const arrowThickness = 8;

const arrowAnchors = {
  taskToDrive: {
    start: [
      apexPositions.task[0] + taskCardWidth / 2 + 60,
      apexPositions.task[1] - checkboxFrameSize / 2,
    ] as [number, number],
    end: [
      apexPositions.drive[0] - driveIconSize / 2 - 72,
      apexPositions.drive[1] + driveIconSize / 2 - 60,
    ] as [number, number],
  },
  driveToEmail: {
    start: [
      apexPositions.drive[0] + 20,
      apexPositions.drive[1] + driveIconSize / 2 + 60,
    ] as [number, number],
    end: [
      apexPositions.email[0],
      apexPositions.email[1] - emailIconSize.height / 2 - 72,
    ] as [number, number],
  },
  emailToTask: {
    start: [
      apexPositions.email[0] - emailIconSize.width / 2 - 60,
      apexPositions.email[1] + emailIconSize.height / 2,
    ] as [number, number],
    end: [
      apexPositions.task[0] + taskCardWidth / 2 + 48,
      apexPositions.task[1] + checkboxFrameSize,
    ] as [number, number],
  },
};

const initialZoom = 1.36;

export default makeScene2D(function* (view) {
  const camera = createRef<Camera>();
  const taskCardRef = createRef<Rect>();
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

  const nextDocumentKeyPrefix = () =>
    `external-api-document-${documentVersion++}`;

  const logDocumentState = (label: string) => {
    const documentNode = taskDocumentRef();
    if (!documentNode) {
      console.log('[external_api] logDocumentState skipped (no document node)', {
        label,
      });
      return;
    }

    const parent = documentNode.parent();
    const parentInfo = parent
      ? {
          key: parent.key,
          name: parent.constructor?.name,
          childIndex: parent.children().indexOf(documentNode),
        }
      : null;

    const childSummaries = documentNode.children().map((child, index) => {
      const anyChild = child as any;
      const absolutePositionValue =
        typeof anyChild.absolutePosition === 'function'
          ? anyChild.absolutePosition()
          : null;
      const absolutePosition = absolutePositionValue
        ? {
            x: Number(absolutePositionValue.x.toFixed(2)),
            y: Number(absolutePositionValue.y.toFixed(2)),
          }
        : null;
      const opacity =
        typeof anyChild.opacity === 'function' ? anyChild.opacity() : null;

      return {
        index,
        key: child.key,
        name: child.constructor?.name,
        parentKey: child.parent()?.key,
        childCount: child.children().length,
        opacity,
        absolutePosition,
      };
    });

    console.log('[external_api] document state snapshot', {
      label,
      documentKey: documentNode.key,
      parent: parentInfo,
      childCount: documentNode.children().length,
      childSummaries,
    });
  };

  const rebuildDocument = () => {
    parsedDocument = parseDocument(currentLines);
    tagColor(parsedDocument.lines[0]?.tagColor ?? defaultTagColor);
    const documentNode = taskDocumentRef();
    if (!documentNode) {
      console.warn('[external_api] rebuildDocument called before document node is ready');
      return;
    }
    const keyPrefix = nextDocumentKeyPrefix();
    const existingChildren = documentNode.children().length;
    console.log('[external_api] rebuildDocument start', {
      keyPrefix,
      currentLines: [...currentLines],
      existingChildren,
      parsedLineSummaries: parsedDocument.lines.map(line => ({
        marker: line.marker,
        checkboxState: line.checkboxState,
        segments: line.segments.map(segment =>
          segment.type === 'tag'
            ? {type: segment.type, raw: segment.raw, tagName: segment.tagName, recognized: segment.recognized}
            : {type: segment.type, text: segment.text},
        ),
      })),
    });
    documentNode.removeChildren();
    const builtNodes = buildDocumentNodes(parsedDocument, {keyPrefix});
    documentNode.add(builtNodes);
    const childSummaries = documentNode
      .children()
      .map(child => ({
        key: child.key,
        name: child.constructor?.name,
        parent: child.parent()?.key,
      }));
    console.log('[external_api] rebuildDocument end', {
      addedNodes: Array.isArray(builtNodes) ? builtNodes.length : 1,
      childCount: documentNode.children().length,
      childSummaries,
    });
    logDocumentState('immediately after rebuild');
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
          ref={taskCardRef}
          layout
          direction={'column'}
          alignItems={'start'}
          justifyContent={'start'}
          padding={taskCardPadding}
          gap={defaultLayoutConfig.columnGap}
          width={taskCardWidth}
          fill={'#101724'}
          radius={48}
          shadowColor={'#00000088'}
          shadowBlur={72}
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
        </Rect>

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
            <Line
              layout={false}
              points={[
                [0, -84],
                [92, 68],
                [-92, 68],
              ]}
              closed
              fill={'#1f2937'}
              stroke={'#0b1220'}
              lineWidth={6}
            />
            <Line
              layout={false}
              points={[
                [0, -84],
                [-92, 68],
                [-26, 8],
              ]}
              closed
              fill={'#34d399'}
            />
            <Line
              layout={false}
              points={[
                [0, -84],
                [92, 68],
                [24, 8],
              ]}
              closed
              fill={'#0ea5e9'}
            />
            <Line
              layout={false}
              points={[
                [-26, 8],
                [24, 8],
                [92, 68],
                [-92, 68],
              ]}
              closed
              fill={'#facc15'}
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
          points={[arrowAnchors.taskToDrive.start, arrowAnchors.taskToDrive.end]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          lineCap={'round'}
          end={arrowTaskToDriveProgress}
          opacity={arrowTaskToDriveOpacity}
          endArrow
        />

        <Line
          layout={false}
          points={[arrowAnchors.driveToEmail.start, arrowAnchors.driveToEmail.end]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          lineCap={'round'}
          end={arrowDriveToEmailProgress}
          opacity={arrowDriveToEmailOpacity}
          endArrow
        />

        <Line
          layout={false}
          points={[arrowAnchors.emailToTask.start, arrowAnchors.emailToTask.end]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          lineCap={'round'}
          end={arrowEmailToTaskProgress}
          opacity={arrowEmailToTaskOpacity}
          endArrow
        />

        <Line
          layout={false}
          points={[
            [-14, -4],
            [14, 12],
            [4, 14],
            [10, 32],
            [2, 30],
            [-8, 16],
          ]}
          closed
          fill={'#f8fafc'}
          stroke={'#0f172a'}
          lineWidth={2}
          position={() => [cursorX(), cursorY()]}
          scale={cursorScale}
          opacity={cursorOpacity}
        />
      </Camera>
    </Rect>,
  );

  if (taskDocumentRef()) {
    const alreadyMountedDocument = taskDocumentRef();
    console.log('[external_api] task document node was already mounted', {
      childCount: alreadyMountedDocument?.children().length,
      childKeys: alreadyMountedDocument?.children().map(child => child.key),
    });
  } else {
    while (!taskDocumentRef()) {
      console.log('[external_api] waiting for task document node to mount');
      yield;
    }

    const mountedDocument = taskDocumentRef();
    console.log('[external_api] task document node mounted', {
      childCount: mountedDocument?.children().length,
      childKeys: mountedDocument?.children().map(child => child.key),
    });
  }

  rebuildDocument();

  yield* waitFor(0);
  logDocumentState('after initial rebuild next frame');

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

  yield* waitFor(0);
  logDocumentState('after in-progress update next frame');

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
  );
  yield* arrowDriveToEmailOpacity(0, 0.12, easeInOutCubic);
  arrowDriveToEmailProgress(0);

  yield* emailCaptionOpacity(1, 0.4, easeInOutCubic);

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
    currentLines.push('    - https://docs.google.com/document/d/rental-application');
  }
  rebuildDocument();

  yield* waitFor(0);
  logDocumentState('after final update next frame');

  yield* waitFor(1.4);
});
