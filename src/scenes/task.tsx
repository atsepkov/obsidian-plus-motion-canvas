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

const initialLines = [
  '- #idea use daily notes as control center for workflows',
  '    - use Obsidian Plus as a message service:',
  '        - integrate with external APIs',
  '        - pass messages between notebooks',
  '        - as a markdown-based no-code alternative',
];

export default makeScene2D(function* (view) {
  let currentLines = [...initialLines];
  let parsedDocument = parseDocument(currentLines);
  const documentRef = createRef<Layout>();
  let documentVersion = 0;

  const nextDocumentKeyPrefix = () => `task-document-${documentVersion++}`;

  const rebuild = () => {
    parsedDocument = parseDocument(currentLines);
    const documentNode = documentRef();
    documentNode.removeChildren();
    documentNode.add(
      buildDocumentNodes(parsedDocument, {
        keyPrefix: nextDocumentKeyPrefix(),
      }),
    );
  };

  view.add(
    <Rect
      layout
      direction={'column'}
      width={stageWidth}
      height={stageHeight}
      fill={'#0f1218'}
      justifyContent={'center'}
      alignItems={'start'}
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
          layout
          width={stageWidth - viewportPadding * 2}
          ref={documentRef}
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

  yield* waitFor(0.8);

  const rootTagOriginal = 'idea';
  const rootTagTarget = 'todo';

  const updateTagBody = (body: string) => {
    currentLines[0] = currentLines[0].replace(/#\S*/, `#${body}`);
    rebuild();
  };

  for (let remaining = rootTagOriginal.length - 1; remaining >= 0; remaining--) {
    updateTagBody(rootTagOriginal.slice(0, remaining));
    yield* waitFor(remaining === 0 ? 0.18 : 0.08);
  }

  for (let index = 1; index <= rootTagTarget.length; index++) {
    updateTagBody(rootTagTarget.slice(0, index));
    yield* waitFor(index === rootTagTarget.length ? 0.2 : 0.08);
  }

  yield* waitFor(0.4);

  currentLines[0] = currentLines[0].replace('- ', '- [');
  rebuild();
  yield* waitFor(0.12);

  currentLines[0] = currentLines[0].replace('- [', '- [ ]');
  rebuild();
  yield* waitFor(0.12);

  currentLines[0] = currentLines[0].replace(']#', '] #');
  rebuild();
  yield* waitFor(0.18);

  yield* waitFor(0.5);

  const statusSequence: Array<{char: string; delay: number}> = [
    {char: '/', delay: 0.6},
    {char: '-', delay: 0.6},
    {char: '!', delay: 0.6},
    {char: '?', delay: 0.6},
    {char: 'x', delay: 0.2},
  ];

  const updateStatus = (char: string) => {
    currentLines[0] = currentLines[0].replace(/- \[[ xX/\-!\?]\]/, `- [${char}]`);
    rebuild();
  };

  for (const {char, delay} of statusSequence) {
    updateStatus(char);
    yield* waitFor(delay);
  }

  currentLines[0] = `${currentLines[0]} ✅ 2025-10-22`;
  rebuild();

  yield* waitFor(1.4);
});
