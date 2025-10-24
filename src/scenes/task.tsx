import {Circle, Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';

const tagPalette: Record<string, string> = {
  todo: '#8f6bff',
  backlog: '#4ba3ff',
  tag: '#38bdf8',
  idea: '#facc15',
};

const defaultTagColor = '#94a3b8';

const checkboxFrameSize = 36;
const checkboxCircleSize = 30;
const indentSpaceWidth = 16;
const rowHeight = 48;
const columnGap = 6;

const initialLines = [
  '- #idea use daily notes as control center for workflows',
  '    - use Obsidian Plus as a message service:',
  '        - integrate with external APIs',
  '        - pass messages between notebooks',
  '        - as a markdown-based no-code alternative',
];

type MarkerType = 'bullet' | 'checkbox' | null;

type CheckboxState =
  | 'unchecked'
  | 'done'
  | 'inProgress'
  | 'cancelled'
  | 'error'
  | 'question';

interface TextSegment {
  type: 'text';
  text: string;
}

interface TagSegment {
  type: 'tag';
  raw: string;
  tagName: string;
  recognized: boolean;
  color?: string;
}

type Segment = TextSegment | TagSegment;

interface ConnectorInfo {
  height: number;
  offset: number;
  color: string;
}

interface ParsedLine {
  indentSpaces: number;
  indentLevel: number;
  marker: MarkerType;
  checkboxState?: CheckboxState;
  segments: Segment[];
  hasTag: boolean;
  tagRecognized: boolean;
  tagColor: string;
  connector: ConnectorInfo | null;
}

interface ParsedDocument {
  lines: ParsedLine[];
  lineCenters: number[];
}

const checkboxCharToState: Record<string, CheckboxState> = {
  ' ': 'unchecked',
  x: 'done',
  X: 'done',
  '/': 'inProgress',
  '-': 'cancelled',
  '!': 'error',
  '?': 'question',
};

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let index = 0;

  while (index < content.length) {
    if (content[index] === '#') {
      let end = index + 1;
      while (end < content.length && !isWhitespace(content[end])) {
        end++;
      }
      const raw = content.slice(index, end);
      const tagName = raw.slice(1);
      const color = tagPalette[tagName];
      segments.push({
        type: 'tag',
        raw,
        tagName,
        recognized: tagName.length > 0 && color !== undefined,
        color,
      });
      index = end;
      continue;
    }

    let end = index + 1;
    while (end < content.length && content[end] !== '#') {
      end++;
    }
    segments.push({
      type: 'text',
      text: content.slice(index, end),
    });
    index = end;
  }

  if (segments.length === 0) {
    segments.push({type: 'text', text: ''});
  }

  return segments;
}

function parseLine(rawLine: string): ParsedLine {
  const leadingSpacesMatch = rawLine.match(/^ */);
  const indentSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0;
  const indentLevel = Math.floor(indentSpaces / 4);

  let remainder = rawLine.slice(indentSpaces);
  let marker: MarkerType = null;
  let checkboxState: CheckboxState | undefined;

  const checkboxMatch = remainder.match(/^- \[([ xX/\-!\?])\]/);
  if (checkboxMatch) {
    marker = 'checkbox';
    const stateChar = checkboxMatch[1];
    checkboxState = checkboxCharToState[stateChar] ?? 'unchecked';
    remainder = remainder.slice(checkboxMatch[0].length);
  } else if (remainder.startsWith('-')) {
    marker = 'bullet';
    remainder = remainder.slice(1);
  }

  remainder = remainder.replace(/^ +/, '');
  const segments = parseSegments(remainder);
  const firstTag = segments.find(
    (segment): segment is TagSegment => segment.type === 'tag',
  );
  const hasTag = firstTag !== undefined;
  const tagRecognized = !!firstTag?.recognized;
  const tagColor = tagRecognized
    ? firstTag?.color ?? defaultTagColor
    : defaultTagColor;

  return {
    indentSpaces,
    indentLevel,
    marker,
    checkboxState,
    segments,
    hasTag,
    tagRecognized,
    tagColor,
    connector: null,
  } satisfies ParsedLine;
}

function parseDocument(lines: string[]): ParsedDocument {
  const parsedLines = lines.map(parseLine);
  const lineCount = parsedLines.length;
  const totalHeight = lineCount * rowHeight + Math.max(0, lineCount - 1) * columnGap;
  const firstLineCenter = -totalHeight / 2 + rowHeight / 2;
  const lineCenters = Array.from({length: lineCount}, (_, index) =>
    firstLineCenter + index * (rowHeight + columnGap),
  );

  for (let index = 0; index < parsedLines.length; index++) {
    const line = parsedLines[index];
    const childIndices: number[] = [];

    for (let j = index + 1; j < parsedLines.length; j++) {
      if (parsedLines[j].indentLevel <= line.indentLevel) {
        break;
      }
      childIndices.push(j);
    }

    if (!line.hasTag || childIndices.length === 0) {
      line.connector = null;
      continue;
    }

    const firstChild = childIndices[0];
    const lastChild = childIndices[childIndices.length - 1];
    const parentCenter = lineCenters[index];
    const firstChildTop = lineCenters[firstChild] - rowHeight / 2;
    const lastChildBottom = lineCenters[lastChild] + rowHeight / 2;
    const height = Math.max(0, lastChildBottom - firstChildTop);
    const offset = firstChildTop + height / 2 - parentCenter;

    line.connector = {
      color: line.tagRecognized ? line.tagColor : defaultTagColor,
      height,
      offset,
    } satisfies ConnectorInfo;
  }

  return {lines: parsedLines, lineCenters};
}

function renderCheckboxIcon(state: CheckboxState) {
  const baseFill = (() => {
    switch (state) {
      case 'done':
        return '#5eea91';
      case 'inProgress':
        return '#f59e0b';
      case 'cancelled':
        return '#475569';
      case 'error':
        return '#ef4444';
      case 'question':
        return '#a855f7';
      case 'unchecked':
      default:
        return '#0f1218';
    }
  })();

  const strokeColor = (() => {
    switch (state) {
      case 'unchecked':
        return '#cbd5f5';
      case 'inProgress':
        return '#fbbf24';
      default:
        return baseFill;
    }
  })();

  const strokeWidth =
    state === 'unchecked' || state === 'inProgress' ? 4 : 0;

  return (
    <Rect
      layout
      justifyContent={'center'}
      alignItems={'center'}
      width={checkboxFrameSize}
      height={checkboxFrameSize}
      marginRight={12}
    >
      <Circle layout={false} size={checkboxCircleSize} fill={baseFill} lineWidth={0} />
      <Line
        layout={false}
        points={[
          [-6, 0],
          [-1, 6],
          [9, -6],
        ]}
        stroke={'#06130a'}
        lineWidth={5}
        lineCap={'round'}
        lineJoin={'round'}
        opacity={state === 'done' ? 1 : 0}
      />
      <Rect
        layout={false}
        width={18}
        height={4}
        radius={2}
        fill={'#e2e8f0'}
        opacity={state === 'cancelled' ? 1 : 0}
      />
      <Rect
        layout={false}
        x={-1}
        justifyContent={'center'}
        alignItems={'center'}
        opacity={state === 'error' ? 1 : 0}
      >
        <Txt
          layout={false}
          text={'!'}
          fontFamily={'Inter, sans-serif'}
          fontSize={24}
          fill={'#fef2f2'}
        />
      </Rect>
      <Rect
        layout={false}
        justifyContent={'center'}
        alignItems={'center'}
        opacity={state === 'question' ? 1 : 0}
      >
        <Txt
          layout={false}
          text={'?'}
          fontFamily={'Inter, sans-serif'}
          fontSize={24}
          fill={'#ede9fe'}
        />
      </Rect>
      <Circle
        layout={false}
        size={checkboxCircleSize}
        stroke={strokeColor}
        lineWidth={strokeWidth}
        fill={'#00000000'}
      />
    </Rect>
  );
}

function renderSegment(segment: Segment) {
  if (segment.type === 'text') {
    return (
      <Txt
        text={segment.text}
        fontFamily={'JetBrains Mono, Fira Code, monospace'}
        fontSize={36}
        fill={'#d7deeb'}
      />
    );
  }

  const showPill = segment.recognized && segment.tagName.length > 0;

  if (!showPill) {
    return (
      <Txt
        text={segment.raw}
        fontFamily={'JetBrains Mono, Fira Code, monospace'}
        fontSize={36}
        fill={'#d7deeb'}
      />
    );
  }

  return (
    <Rect
      layout
      direction={'row'}
      justifyContent={'center'}
      alignItems={'center'}
      radius={999}
      padding={[4, 12]}
      fill={segment.color ?? defaultTagColor}
    >
      <Txt
        text={segment.raw}
        fontFamily={'JetBrains Mono, Fira Code, monospace'}
        fontSize={30}
        fill={'#080b11'}
      />
    </Rect>
  );
}

function buildDocumentNodes(document: ParsedDocument) {
  return document.lines.map((line, lineIndex) => {
    const indentWidth = line.indentSpaces * indentSpaceWidth;
    const markerWidth =
      line.marker === 'checkbox'
        ? checkboxFrameSize
        : line.marker === 'bullet'
        ? 28
        : 0;
    const connectorWidth = line.connector ? 4 : 0;
    const markerColumnWidth = Math.max(markerWidth, connectorWidth);

    return (
      <Rect
        layout
        direction={'row'}
        alignItems={'center'}
        height={rowHeight}
      >
        {indentWidth > 0 && (
          <Rect layout width={indentWidth} height={rowHeight} fill={'#00000000'} />
        )}
        {markerColumnWidth > 0 && (
          <Rect
            layout
            direction={'column'}
            justifyContent={'center'}
            alignItems={'center'}
            width={markerColumnWidth}
            height={rowHeight}
          >
            {line.connector && (
              <Rect
                layout={false}
                width={4}
                radius={999}
                fill={line.connector.color}
                height={line.connector.height}
                y={line.connector.offset}
              />
            )}
            {line.marker === 'bullet' && (
              <Txt
                text={'•'}
                fontFamily={'JetBrains Mono, Fira Code, monospace'}
                fontSize={36}
                fill={'#d7deeb'}
                marginRight={12}
              />
            )}
            {line.marker === 'checkbox' &&
              renderCheckboxIcon(line.checkboxState ?? 'unchecked')}
          </Rect>
        )}
        <Layout direction={'row'} alignItems={'center'} gap={0}>
          {line.segments.map((segment, segmentIndex) => (
            <Layout key={`${lineIndex}-${segmentIndex}`} layout>
              {renderSegment(segment)}
            </Layout>
          ))}
        </Layout>
      </Rect>
    );
  });
}

export default makeScene2D(function* (view) {
  let currentLines = [...initialLines];
  let parsedDocument = parseDocument(currentLines);
  const documentRef = createRef<Layout>();

  const rebuild = () => {
    parsedDocument = parseDocument(currentLines);
    documentRef().removeChildren();
    documentRef().add(buildDocumentNodes(parsedDocument));
  };

  view.add(
    <Rect
      layout
      direction={'column'}
      width={1280}
      height={720}
      fill={'#0f1218'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Layout direction={'column'} padding={48} gap={0} alignItems={'start'}>
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
          direction={'column'}
          gap={columnGap}
          alignItems={'start'}
        >
          {buildDocumentNodes(parsedDocument)}
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
