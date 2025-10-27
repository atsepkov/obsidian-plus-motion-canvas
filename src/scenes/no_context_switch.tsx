import {Layout, Path, Rect, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInOutCubic,
  waitFor,
} from '@motion-canvas/core';

import {buildDocumentNodes, defaultLayoutConfig, parseDocument} from './shared/checklist';

const stageWidth = 1920;
const stageHeight = 1080;
const viewportPadding = 96;

const lineToType =
  '- [ ] #todo eliminate context switch with Obsidian Plus';
const completionSuffix = ' ✅ 2025-10-22';
const childLineContent =
  '    - give it a try: [https://obsidianpl.us](https://obsidianpl.us)';

export default makeScene2D(function* (view) {
  const documentRef = createRef<Layout>();

  let documentVersion = 0;
  const nextDocumentKeyPrefix = () => `no-context-switch-document-${documentVersion++}`;

  const currentLines = [''];
  let parsedDocument = parseDocument(currentLines);

  const rebuildDocument = () => {
    parsedDocument = parseDocument(currentLines);
    const documentNode = documentRef();
    documentNode.removeChildren();
    for (const node of buildDocumentNodes(parsedDocument, {
      keyPrefix: nextDocumentKeyPrefix(),
    })) {
      documentNode.add(node);
    }
  };

  const cursorPathData =
    'M 5.65625 2.09375 C 5.550781 2.070313 5.4375 2.082031 5.34375 2.117188 C 5.160156 2.195313 5 2.402344 5 2.632813 L 5 13.421875 L 7.789063 11.613281 L 9.101563 14.171875 L 11.546875 12.921875 L 10.339844 10.578125 L 13.472656 9.765625 L 12.855469 9.148438 L 5.945313 2.242188 C 5.867188 2.160156 5.761719 2.113281 5.65625 2.09375 Z M 6 3.707031 L 11.527344 9.234375 L 8.878906 9.921875 L 10.199219 12.484375 L 9.539063 12.828125 L 8.171875 10.171875 L 6 11.578125 Z';
  const cursorBaseScale = 6;
  const cursorTipOffset = {
    x: 5 * cursorBaseScale + 960,
    y: 2.081558289 * cursorBaseScale + 540,
  } as const;

  const cursorScale = createSignal(1);
  const cursorOpacity = createSignal(1);
  const cursorX = createSignal(-stageWidth / 2 - 220);
  const cursorY = createSignal(-stageHeight / 2 - 220);

  view.add(
    <Rect
      layout
      width={stageWidth}
      height={stageHeight}
      fill={'#0f1218'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Layout
        layout
        direction={'column'}
        padding={viewportPadding}
        gap={defaultLayoutConfig.columnGap}
        alignItems={'start'}
        width={stageWidth}
      >
        <Layout
          ref={documentRef}
          layout
          direction={'column'}
          gap={defaultLayoutConfig.columnGap}
          alignItems={'start'}
          width={stageWidth - viewportPadding * 2}
        >
          {buildDocumentNodes(parsedDocument, {
            keyPrefix: nextDocumentKeyPrefix(),
          })}
        </Layout>
      </Layout>
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
          fill={'#ffffff'}
          lineJoin={'round'}
        />
      </Layout>
    </Rect>,
  );

  while (!documentRef()) {
    yield;
  }

  rebuildDocument();

  yield* waitFor(0.6);

  for (let index = 0; index < lineToType.length; index++) {
    currentLines[0] = lineToType.slice(0, index + 1);
    rebuildDocument();
    yield* waitFor(0.04);
  }

  yield* waitFor(0.6);

  const documentNode = documentRef();
  let markerCenterX = cursorX();
  let markerCenterY = cursorY();

  if (documentNode) {
    const firstLine = documentNode.children()[0] as Rect | undefined;
    if (firstLine) {
      const markerColumn = firstLine.children()[0] as Rect | undefined;
      if (markerColumn) {
        const markerChildren = markerColumn.children();
        const checkboxNode = markerChildren.find(
          (child): child is Rect => child instanceof Rect,
        );
        const targetNode = checkboxNode ?? markerColumn;
        const markerPosition = targetNode.absolutePosition();
        markerCenterX = markerPosition.x;
        markerCenterY = markerPosition.y;
      }
    }
  }

  yield* all(
    cursorX(markerCenterX, 0.6, easeInOutCubic),
    cursorY(markerCenterY, 0.6, easeInOutCubic),
  );

  yield* cursorScale(0.85, 0.12, easeInOutCubic);
  yield* cursorScale(1, 0.16, easeInOutCubic);

  currentLines[0] = currentLines[0].replace('- [ ]', '- [x]');
  rebuildDocument();

  const baseCompletedLine = currentLines[0];
  yield* waitFor(0.18);

  let suffixProgress = '';
  for (let index = 0; index < completionSuffix.length; index++) {
    suffixProgress = completionSuffix.slice(0, index + 1);
    currentLines[0] = `${baseCompletedLine}${suffixProgress}`;
    rebuildDocument();
    yield* waitFor(0.05);
  }

  yield* waitFor(0.28);

  currentLines.push('');
  rebuildDocument();

  for (let index = 0; index < childLineContent.length; index++) {
    currentLines[1] = childLineContent.slice(0, index + 1);
    rebuildDocument();
    yield* waitFor(0.04);
  }

  yield* cursorOpacity(0, 0.24, easeInOutCubic);

  yield* waitFor(1.0);
});
