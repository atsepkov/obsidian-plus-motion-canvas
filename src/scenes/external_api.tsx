import {Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {createRef, createSignal, waitFor} from '@motion-canvas/core';

import {
  buildDocumentNodes,
  defaultLayoutConfig,
  defaultTagColor,
  parseDocument,
} from './shared/checklist';

const stageWidth = 1920;
const stageHeight = 1080;
const viewportPadding = 96;
const messageWidth = 760;

const initialLines = ['- [ ] #application renter@gmail.com'];

const gmailIconSize = {width: 180, height: 132};
const mailboxIconSize = {width: 180, height: 132};

const arrowThickness = 6;

const messageAnchorX = -40;
const arrowHeightOffsets = {
  toGmail: -40,
  toMailbox: 0,
  backToTask: 72,
};

const gmailCenterX = 260;
const mailboxCenterX = 560;

export default makeScene2D(function* (view) {
  let currentLines = [...initialLines];
  let parsedDocument = parseDocument(currentLines);
  const documentRef = createRef<Layout>();
  const tagColor = createSignal(parsedDocument.lines[0]?.tagColor ?? defaultTagColor);

  const arrowToGmailProgress = createSignal(0);
  const arrowToMailboxProgress = createSignal(0);
  const arrowBackProgress = createSignal(0);
  const gmailCaptionOpacity = createSignal(0);
  const mailboxCaptionOpacity = createSignal(0);

  const rebuild = () => {
    parsedDocument = parseDocument(currentLines);
    tagColor(parsedDocument.lines[0]?.tagColor ?? defaultTagColor);
    documentRef().removeChildren();
    documentRef().add(buildDocumentNodes(parsedDocument));
  };

  const documentContainer = (
    <Rect
      layout
      direction={'column'}
      width={stageWidth}
      height={stageHeight}
      fill={'#0f1218'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Rect
        layout
        direction={'column'}
        width={stageWidth - viewportPadding * 2}
        height={stageHeight - viewportPadding * 2}
        padding={viewportPadding}
        radius={48}
        fill={'#101724'}
      >
        <Layout
          layout
          direction={'column'}
          gap={defaultLayoutConfig.columnGap}
          alignItems={'start'}
          width={messageWidth}
          ref={documentRef}
          x={-420}
          y={-40}
        >
          {buildDocumentNodes(parsedDocument)}
        </Layout>
        <Layout
          layout
          direction={'column'}
          alignItems={'center'}
          gap={24}
          x={gmailCenterX}
          y={-40}
        >
          <Rect
            layout
            width={gmailIconSize.width}
            height={gmailIconSize.height}
            radius={20}
            fill={'#f8fafc'}
            stroke={'#1f2937'}
            lineWidth={4}
          >
            <Line
              layout={false}
              points={[
                [-gmailIconSize.width / 2 + 16, -gmailIconSize.height / 2 + 12],
                [0, 8],
                [gmailIconSize.width / 2 - 16, -gmailIconSize.height / 2 + 12],
              ]}
              stroke={'#ef4444'}
              lineWidth={12}
              lineJoin={'round'}
              lineCap={'round'}
            />
            <Line
              layout={false}
              points={[
                [-gmailIconSize.width / 2 + 20, gmailIconSize.height / 2 - 16],
                [0, -4],
                [gmailIconSize.width / 2 - 20, gmailIconSize.height / 2 - 16],
              ]}
              stroke={'#ef4444'}
              lineWidth={12}
              lineJoin={'round'}
              lineCap={'round'}
            />
          </Rect>
          <Txt
            text={'new rental application from template'}
            fontFamily={'Inter, sans-serif'}
            fontSize={28}
            fill={'#cbd5f5'}
            opacity={gmailCaptionOpacity}
          />
        </Layout>
        <Layout
          layout
          direction={'column'}
          alignItems={'center'}
          gap={24}
          x={mailboxCenterX}
          y={0}
        >
          <Rect
            layout
            width={mailboxIconSize.width}
            height={mailboxIconSize.height}
            radius={20}
            fill={'#1f2937'}
            stroke={'#94a3b8'}
            lineWidth={4}
          >
            <Rect
              layout={false}
              width={mailboxIconSize.width - 40}
              height={mailboxIconSize.height - 40}
              radius={16}
              stroke={'#38bdf8'}
              lineWidth={6}
            />
            <Line
              layout={false}
              points={[
                [-(mailboxIconSize.width - 48) / 2, -12],
                [0, 32],
                [(mailboxIconSize.width - 48) / 2, -12],
              ]}
              stroke={'#38bdf8'}
              lineWidth={6}
              lineJoin={'round'}
              lineCap={'round'}
            />
          </Rect>
          <Txt
            text={'rental applicant'}
            fontFamily={'Inter, sans-serif'}
            fontSize={28}
            fill={'#cbd5f5'}
            opacity={mailboxCaptionOpacity}
          />
        </Layout>
        <Line
          layout={false}
          points={[
            [messageAnchorX, arrowHeightOffsets.toGmail],
            [gmailCenterX - gmailIconSize.width / 2 - 24, arrowHeightOffsets.toGmail],
          ]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          end={arrowToGmailProgress}
          lineCap={'round'}
        />
        <Line
          layout={false}
          points={[
            [0, -10],
            [18, 0],
            [0, 10],
          ]}
          closed
          position={() => [
            messageAnchorX +
              (gmailCenterX - gmailIconSize.width / 2 - 24 - messageAnchorX) * arrowToGmailProgress(),
            arrowHeightOffsets.toGmail,
          ]}
          fill={tagColor}
          stroke={tagColor}
          lineWidth={0}
          opacity={() => (arrowToGmailProgress() > 0 ? 1 : 0)}
        />
        <Line
          layout={false}
          points={[
            [gmailCenterX + gmailIconSize.width / 2 + 24, arrowHeightOffsets.toMailbox],
            [mailboxCenterX - mailboxIconSize.width / 2 - 24, arrowHeightOffsets.toMailbox],
          ]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          end={arrowToMailboxProgress}
          lineCap={'round'}
        />
        <Line
          layout={false}
          points={[
            [0, -10],
            [18, 0],
            [0, 10],
          ]}
          closed
          position={() => [
            (gmailCenterX + gmailIconSize.width / 2 + 24) +
              (mailboxCenterX - mailboxIconSize.width / 2 - 24 -
                (gmailCenterX + gmailIconSize.width / 2 + 24)) *
                arrowToMailboxProgress(),
            arrowHeightOffsets.toMailbox,
          ]}
          fill={tagColor}
          stroke={tagColor}
          lineWidth={0}
          opacity={() => (arrowToMailboxProgress() > 0 ? 1 : 0)}
        />
        <Line
          layout={false}
          points={[
            [mailboxCenterX + mailboxIconSize.width / 2 + 24, arrowHeightOffsets.backToTask],
            [messageAnchorX, arrowHeightOffsets.backToTask],
          ]}
          stroke={tagColor}
          lineWidth={arrowThickness}
          end={arrowBackProgress}
          lineCap={'round'}
        />
        <Line
          layout={false}
          points={[
            [0, -10],
            [-18, 0],
            [0, 10],
          ]}
          closed
          position={() => [
            mailboxCenterX + mailboxIconSize.width / 2 + 24 -
              (mailboxCenterX + mailboxIconSize.width / 2 + 24 - messageAnchorX) * arrowBackProgress(),
            arrowHeightOffsets.backToTask,
          ]}
          fill={tagColor}
          stroke={tagColor}
          lineWidth={0}
          opacity={() => (arrowBackProgress() > 0 ? 1 : 0)}
        />
      </Rect>
    </Rect>
  );

  view.add(documentContainer);

  yield* waitFor(0.8);

  currentLines[0] = currentLines[0].replace('- [ ]', '- [/]');
  rebuild();

  yield* waitFor(0.4);

  yield* arrowToGmailProgress(1, 0.6);
  yield* gmailCaptionOpacity(1, 0.4);

  yield* waitFor(0.3);

  yield* arrowToMailboxProgress(1, 0.6);
  yield* mailboxCaptionOpacity(1, 0.4);

  yield* waitFor(0.4);

  yield* arrowBackProgress(1, 0.6);

  yield* waitFor(0.2);

  currentLines[0] = currentLines[0].replace(/- \[[ xX/\-!\?]\]/, '- [x]');
  if (!currentLines[0].includes('✅')) {
    currentLines[0] = `${currentLines[0]} ✅ 2025-10-22`;
  }
  if (currentLines.length === 1) {
    currentLines.push('    - https://docs.google.com/document/d/rental-application');
  }
  rebuild();

  yield* waitFor(1.6);
});
