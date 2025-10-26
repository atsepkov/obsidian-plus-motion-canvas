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

const initialLines = ['- [ ] #application renter@gmail.com'];

export default makeScene2D(function* (view) {
  const documentRef = createRef<Layout>();
  let documentVersion = 0;
  const nextDocumentKeyPrefix = () => `application-scene-document-${documentVersion++}`;

  let currentLines = [...initialLines];
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

  yield* waitFor(0.8);

  currentLines[0] = currentLines[0].replace(/- \[[^\]]\]/, '- [/]');
  rebuildDocument();

  yield* waitFor(0.8);

  currentLines[0] = currentLines[0].replace(/- \[[^\]]\]/, '- [x]');
  rebuildDocument();

  yield* waitFor(1.2);
});
