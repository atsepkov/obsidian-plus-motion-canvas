import {Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';

import {
  buildDocumentNodes,
  defaultLayoutConfig,
  parseDocument,
} from './shared/checklist';

const stageWidth = 1920;
const stageHeight = 1080;
const viewportPadding = 96;

const targetLines = [
  'What I need to get done:',
  '- buy groceries',
  '- setup mortgage autopay',
  '- schedule appliance repair',
  '',
  'Personal Project:',
  '- need to finish troubleshooting the timestamp issue',
  '- feature idea: install flux capacitor',
];

export default makeScene2D(function* (view) {
  const documentRef = createRef<Layout>();
  let documentVersion = 0;

  const nextDocumentKeyPrefix = () => `daily-notes-document-${documentVersion++}`;

  const currentLines = targetLines.map(() => '');
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

  view.add(
    <Rect
      layout
      direction={'column'}
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
        gap={0}
        alignItems={'start'}
        width={stageWidth}
      >
        <Txt
          text={'Daily Notes'}
          fontFamily={'Inter, sans-serif'}
          fontSize={40}
          fill={'#9da8ba'}
          opacity={0}
          height={0}
          marginBottom={0}
        />
        <Layout
          ref={documentRef}
          layout
          width={stageWidth - viewportPadding * 2}
          direction={'column'}
          gap={defaultLayoutConfig.columnGap}
          alignItems={'start'}
        >
          {buildDocumentNodes(parsedDocument, {
            keyPrefix: nextDocumentKeyPrefix(),
          })}
        </Layout>
      </Layout>
    </Rect>,
  );

  yield* waitFor(0.6);

  for (let lineIndex = 0; lineIndex < targetLines.length; lineIndex++) {
    const targetLine = targetLines[lineIndex];

    if (targetLine.length === 0) {
      currentLines[lineIndex] = '';
      rebuildDocument();
      yield* waitFor(0.2);
      continue;
    }

    for (let charIndex = 0; charIndex < targetLine.length; charIndex++) {
      currentLines[lineIndex] = targetLine.slice(0, charIndex + 1);
      rebuildDocument();
      yield* waitFor(0.04);
    }

    yield* waitFor(0.3);
  }

  yield* waitFor(1.2);

  const firstTaskLineIndex = targetLines.indexOf('- buy groceries');

  if (firstTaskLineIndex >= 0) {
    const originalLine = currentLines[firstTaskLineIndex];
    const insertion = '[ ] #todo ';

    yield* waitFor(0.4);

    for (let charIndex = 0; charIndex < insertion.length; charIndex++) {
      currentLines[firstTaskLineIndex] =
        originalLine.slice(0, 2) +
        insertion.slice(0, charIndex + 1) +
        originalLine.slice(2);
      rebuildDocument();
      yield* waitFor(0.06);
    }
  }

  yield* waitFor(0.6);
});
