import {Circle, Layout, Line, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {SimpleSignal, createSignal, waitFor} from '@motion-canvas/core';

type TokenType = 'checkbox' | 'tag' | 'text' | 'space' | 'bullet';

type CheckboxState =
  | 'unchecked'
  | 'done'
  | 'inProgress'
  | 'cancelled'
  | 'error'
  | 'question';

interface BaseToken {
  type: TokenType;
  raw: string;
  length: number;
}

interface CheckboxToken extends BaseToken {
  type: 'checkbox';
  state: CheckboxState;
}

interface TagToken extends BaseToken {
  type: 'tag';
  tagName: string;
}

interface TextToken extends BaseToken {
  type: 'text';
}

interface SpaceToken extends BaseToken {
  type: 'space';
  width: number;
}

interface BulletToken extends BaseToken {
  type: 'bullet';
}

type Token = CheckboxToken | TagToken | TextToken | SpaceToken | BulletToken;

type TokenWithRange = Token & {
  start: number;
  end: number;
  lineIndex: number;
  checkboxIndex?: number;
};

interface LineRange {
  start: number;
  end: number;
}

type MarkerType = 'checkbox' | 'bullet' | null;

interface LineAnalysis {
  indentSpaces: number;
  indentLevel: number;
  marker: MarkerType;
  connectorTagName: string | null;
}

interface ConnectorMeta {
  color: string;
  childIndices: number[];
}

const tagPalette: Record<string, string> = {
  todo: '#8f6bff',
  backlog: '#4ba3ff',
  tag: '#38bdf8',
};

const defaultTagColor = '#94a3b8';

const checkboxFrameSize = 36;
const checkboxCircleSize = 30;

const checklistLines = [
  '- [ ] #todo install Obsidian Plus',
  '    - additional context',
  '    - random bullet with a #tag',
  '    - [ ] capture reference screenshot',
  '- [ ] #backlog research plugin API',
];

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

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < line.length) {
    const current = line[index];

    const checkboxMatch = line.slice(index).match(/^-\s\[([ xX/\-!\?])\]/);
    if (checkboxMatch) {
      const raw = checkboxMatch[0];
      const stateChar = checkboxMatch[1];
      const state = checkboxCharToState[stateChar] ?? 'unchecked';
      tokens.push({
        type: 'checkbox',
        raw,
        length: raw.length,
        state,
      });
      index += raw.length;
      continue;
    }

    if (current === ' ') {
      let end = index + 1;
      while (end < line.length && line[end] === ' ') {
        end++;
      }
      const raw = line.slice(index, end);
      const previousToken = tokens[tokens.length - 1];
      const baseWidth =
        previousToken?.type === 'checkbox'
          ? checkboxFrameSize - 10
          : previousToken?.type === 'bullet'
          ? 20
          : 16;
      tokens.push({
        type: 'space',
        raw,
        length: raw.length,
        width: baseWidth * raw.length,
      });
      index = end;
      continue;
    }

    if (current === '-' && line[index + 1] === ' ') {
      tokens.push({
        type: 'bullet',
        raw: '-',
        length: 1,
      });
      index += 1;
      continue;
    }

    if (current === '#') {
      let end = index + 1;
      while (end < line.length && !isWhitespace(line[end])) {
        end++;
      }
      const raw = line.slice(index, end);
      tokens.push({
        type: 'tag',
        raw,
        length: raw.length,
        tagName: raw.slice(1),
      });
      index = end;
      continue;
    }

    let end = index + 1;
    while (end < line.length) {
      const char = line[end];
      if (char === '#' || isWhitespace(char)) {
        break;
      }
      end++;
    }

    const raw = line.slice(index, end);
    tokens.push({
      type: 'text',
      raw,
      length: raw.length,
    });
    index = end;
  }

  return tokens;
}

function analyzeLine(rawLine: string): LineAnalysis {
  const leadingSpacesMatch = rawLine.match(/^ */);
  const indentSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0;
  const indentLevel = Math.floor(indentSpaces / 4);

  let remainder = rawLine.slice(indentSpaces);
  let marker: MarkerType = null;

  const checkboxMatch = remainder.match(/^- \[([ xX/\-!\?])\]/);
  if (checkboxMatch) {
    marker = 'checkbox';
    remainder = remainder.slice(checkboxMatch[0].length);
  } else if (remainder.startsWith('-')) {
    marker = 'bullet';
    remainder = remainder.slice(1);
  }

  remainder = remainder.replace(/^\s+/, '');

  let connectorTagName: string | null = null;
  if (remainder.startsWith('#')) {
    const tagMatch = remainder.match(/^#([^\s]+)/);
    if (tagMatch) {
      connectorTagName = tagMatch[1];
    }
  }

  return {
    indentSpaces,
    indentLevel,
    marker,
    connectorTagName,
  };
}

function splitLineTokens(lineTokens: TokenWithRange[]) {
  const indentTokens: TokenWithRange[] = [];
  let index = 0;

  while (
    index < lineTokens.length &&
    lineTokens[index].type === 'space' &&
    lineTokens[index].raw.trim() === ''
  ) {
    indentTokens.push(lineTokens[index]);
    index++;
  }

  let markerToken: TokenWithRange | null = null;
  if (
    index < lineTokens.length &&
    (lineTokens[index].type === 'checkbox' || lineTokens[index].type === 'bullet')
  ) {
    markerToken = lineTokens[index];
    index++;
  }

  const contentTokens = lineTokens.slice(index);

  return {indentTokens, markerToken, contentTokens};
}

export default makeScene2D(function* (view) {
  const lineAnalyses = checklistLines.map(analyzeLine);
  const tokenizedLines = checklistLines.map(tokenizeLine);

  const rowHeight = 40;
  const columnGap = 0;
  const lineCount = tokenizedLines.length;
  const totalHeight = lineCount * rowHeight + (lineCount - 1) * columnGap;
  const firstLineCenter = -totalHeight / 2 + rowHeight / 2;
  const lineCenters = Array.from({length: lineCount}, (_, index) =>
    firstLineCenter + index * (rowHeight + columnGap),
  );

  const connectors: (ConnectorMeta | null)[] = lineAnalyses.map((info, index) => {
    if (!info.connectorTagName) {
      return null;
    }

    const childIndices: number[] = [];
    for (let j = index + 1; j < lineCount; j++) {
      const potentialChild = lineAnalyses[j];
      if (potentialChild.indentLevel <= info.indentLevel) {
        break;
      }
      childIndices.push(j);
    }

    if (childIndices.length === 0) {
      return null;
    }

    return {
      color: tagPalette[info.connectorTagName] ?? defaultTagColor,
      childIndices,
    } satisfies ConnectorMeta;
  });

  let runningTotal = 0;
  const checkboxStateSignals: SimpleSignal<CheckboxState>[] = [];
  const checkboxIndicesByLine: number[][] = tokenizedLines.map(
    () => [] as number[],
  );
  let checkboxCounter = 0;
  const linesWithRanges: TokenWithRange[][] = tokenizedLines.map((lineTokens, lineIndex) =>
    lineTokens.map((token) => {
      const start = runningTotal;
      const end = start + token.length;
      runningTotal = end;
      const tokenWithRange: TokenWithRange = {
        ...token,
        start,
        end,
        lineIndex,
      };

      if (token.type === 'checkbox') {
        tokenWithRange.checkboxIndex = checkboxCounter;
        checkboxStateSignals.push(createSignal<CheckboxState>(token.state));
        checkboxIndicesByLine[lineIndex].push(checkboxCounter);
        checkboxCounter++;
      }

      return tokenWithRange;
    }),
  );

  const totalCharacters = runningTotal;

  const lineRanges: LineRange[] = linesWithRanges.map((lineTokens) => {
    if (lineTokens.length === 0) {
      return {start: 0, end: 0};
    }
    return {
      start: lineTokens[0].start,
      end: lineTokens[lineTokens.length - 1].end,
    };
  });

  const fullText = linesWithRanges.flat().map((token) => token.raw).join('');

  const splitLines = linesWithRanges.map(splitLineTokens);

  const markerRevealThresholds = splitLines.map(({markerToken, contentTokens}, index) => {
    if (markerToken) {
      return markerToken.end;
    }

    const firstContent = contentTokens[0];
    if (firstContent) {
      return firstContent.start;
    }

    return lineRanges[index].end;
  });

  const lineBreakStops = new Set<number>();
  lineRanges.forEach((range, index) => {
    if (index < lineRanges.length - 1) {
      lineBreakStops.add(range.end);
    }
  });

  const typed = createSignal(0);

  const caretVisible = () => typed() < totalCharacters;

  const activeLineIndex = () => {
    for (let i = 0; i < lineRanges.length; i++) {
      if (typed() < lineRanges[i].end) {
        return i;
      }
    }
    return lineRanges.length - 1;
  };

  const typedWithin = (token: TokenWithRange) => () =>
    Math.max(0, Math.min(token.length, typed() - token.start));

  const renderCheckboxIcon = (
    stateSignal: SimpleSignal<CheckboxState>,
    visibility: () => number,
  ) => {
    const radius = checkboxCircleSize / 2;

    const baseFill = () => {
      switch (stateSignal()) {
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
    };

    const strokeColor = () => {
      switch (stateSignal()) {
        case 'unchecked':
          return '#cbd5f5';
        case 'inProgress':
          return '#fbbf24';
        default:
          return baseFill();
      }
    };

    const strokeWidth = () => {
      switch (stateSignal()) {
        case 'unchecked':
        case 'inProgress':
          return 4;
        default:
          return 0;
      }
    };

    const wedgeSweep = Math.PI / 2.6;
    const wedgeStart = -Math.PI / 3;
    const wedgeArcPoints: [number, number][] = [];
    for (let index = 0; index < 10; index++) {
      const angle = wedgeStart + (wedgeSweep * index) / 9;
      wedgeArcPoints.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
    }
    const wedgePoints: [number, number][] = [[0, 0], ...wedgeArcPoints];

    return (
      <Rect
        layout
        justifyContent={'center'}
        alignItems={'center'}
        width={checkboxFrameSize}
        height={checkboxFrameSize}
        opacity={visibility}
      >
        <Circle
          layout={false}
          size={checkboxCircleSize}
          fill={baseFill}
          lineWidth={0}
        />
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
          opacity={() => (stateSignal() === 'done' ? 1 : 0)}
        />
        <Rect
          layout={false}
          width={18}
          height={4}
          radius={2}
          fill={'#e2e8f0'}
          opacity={() => (stateSignal() === 'cancelled' ? 1 : 0)}
        />
        <Rect
          layout={false}
          x={-1}
          justifyContent={'center'}
          alignItems={'center'}
        >
          <Txt
            layout={false}
            text={'!'}
            fontFamily={'Inter, sans-serif'}
            fontSize={24}
            fill={'#fef2f2'}
            opacity={() => (stateSignal() === 'error' ? 1 : 0)}
          />
        </Rect>
        <Rect
          layout={false}
          x={0}
          justifyContent={'center'}
          alignItems={'center'}
        >
          <Txt
            layout={false}
            text={'?'}
            fontFamily={'Inter, sans-serif'}
            fontSize={24}
            fill={'#ede9fe'}
            opacity={() => (stateSignal() === 'question' ? 1 : 0)}
          />
        </Rect>
        <Line
          layout={false}
          points={wedgePoints}
          closed
          fill={'#0f1218'}
          lineWidth={0}
          opacity={() => (stateSignal() === 'inProgress' ? 1 : 0)}
          lineJoin={'round'}
        />
        <Circle
          layout={false}
          size={checkboxCircleSize}
          stroke={strokeColor}
          lineWidth={strokeWidth}
          fill={'#00000000'}
        />
      </Rect>
    );
  };

  const renderTokenNode = (token: TokenWithRange, isMarker = false) => {
    const portion = typedWithin(token);

    switch (token.type) {
      case 'checkbox':
        return (
          <Rect
            layout
            justifyContent={'center'}
            alignItems={'center'}
            width={checkboxFrameSize}
            height={checkboxFrameSize}
            marginRight={isMarker ? 0 : 4}
          >
            <Txt
              text={() => (portion() < token.length ? token.raw.slice(0, portion()) : '')}
              fontFamily={'JetBrains Mono, Fira Code, monospace'}
              fontSize={36}
              fill={'#d7deeb'}
              opacity={() => (portion() < token.length ? 1 : 0)}
            />
            {token.checkboxIndex !== undefined &&
              renderCheckboxIcon(
                checkboxStateSignals[token.checkboxIndex],
                () => (portion() >= token.length ? 1 : 0),
              )}
          </Rect>
        );
      case 'tag':
        return (
          <Rect
            layout
            direction={'row'}
            radius={999}
            fill={() => tagPalette[token.tagName] ?? defaultTagColor}
            padding={() =>
              portion() > 0 ? ([4, 12] as const) : ([0, 0] as const)
            }
            opacity={() => (portion() > 0 ? 1 : 0)}
            marginLeft={0}
          >
            <Txt
              text={() => token.raw.slice(0, portion())}
              fontFamily={'JetBrains Mono, Fira Code, monospace'}
              fontSize={30}
              fill={'#080b11'}
            />
          </Rect>
        );
      case 'space':
        return (
          <Rect width={() => (portion() > 0 ? token.width : 0)} height={1} />
        );
      case 'bullet':
        return (
          <Txt
            text={() =>
              portion() < token.length ? token.raw.slice(0, portion()) : '•'
            }
            fontFamily={'JetBrains Mono, Fira Code, monospace'}
            fontSize={36}
            fill={'#d7deeb'}
            marginRight={isMarker ? 0 : 4}
          />
        );
      case 'text':
      default:
        return (
          <Txt
            text={() => token.raw.slice(0, portion())}
            fontFamily={'JetBrains Mono, Fira Code, monospace'}
            fontSize={36}
            fill={'#d7deeb'}
          />
        );
    }
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
      <Layout
        direction={'column'}
        padding={48}
        gap={columnGap}
        alignItems={'start'}
      >
        <Txt
          text={'Daily Notes'}
          fontFamily={'Inter, sans-serif'}
          fontSize={40}
          fill={'#9da8ba'}
        />
        {splitLines.map(({indentTokens, markerToken, contentTokens}, lineIndex) => {
          const connector = connectors[lineIndex];
          const markerWidth =
            markerToken?.type === 'checkbox'
              ? checkboxFrameSize
              : markerToken?.type === 'bullet'
              ? 28
              : 0;
          const markerPortion = markerToken ? typedWithin(markerToken) : null;
          const markerWidthValue = () => {
            if (!markerToken || !markerPortion) {
              return 0;
            }
            const typedCount = Math.max(0, markerPortion());
            if (typedCount >= markerToken.length) {
              return markerWidth;
            }
            const estimated = typedCount * 12;
            return Math.min(markerWidth, estimated);
          };
          const connectorPlacement = () => {
            if (!connector) {
              return {height: 0, offset: 0};
            }

            if (typed() < markerRevealThresholds[lineIndex]) {
              return {height: 0, offset: 0};
            }

            const activeChildren = connector.childIndices.filter(
              (childIndex) => typed() >= markerRevealThresholds[childIndex],
            );

            if (activeChildren.length === 0) {
              return {height: 0, offset: 0};
            }

            const firstChild = activeChildren[0];
            const lastChild = activeChildren[activeChildren.length - 1];

            const parentCenter = lineCenters[lineIndex];
            const firstChildTop = lineCenters[firstChild] - rowHeight / 2;
            const lastChildBottom = lineCenters[lastChild] + rowHeight / 2;

            const height = Math.max(0, lastChildBottom - firstChildTop);
            const offset = firstChildTop + height / 2 - parentCenter;

            return {height, offset};
          };

          return (
            <Rect
              layout
              direction={'row'}
              gap={0}
              alignItems={'center'}
              height={rowHeight}
            >
              {indentTokens.map((token) => renderTokenNode(token))}
              {(markerToken || connector) && (
                <Rect
                  layout
                  direction={'column'}
                  justifyContent={'center'}
                  alignItems={'center'}
                  width={markerWidthValue}
                  height={rowHeight}
                >
                  {connector && (
                    <Rect
                      layout={false}
                      width={4}
                      radius={999}
                      fill={connector.color}
                      y={() => connectorPlacement().offset}
                      height={() => connectorPlacement().height}
                      opacity={() =>
                        connectorPlacement().height > 0 ? 1 : 0
                      }
                    />
                  )}
                  {markerToken && renderTokenNode(markerToken, true)}
                </Rect>
              )}
              {contentTokens.map((token) => renderTokenNode(token))}
              <Rect
                width={4}
                height={rowHeight - 16}
                fill={'#cbd5f5'}
                opacity={() =>
                  caretVisible() && activeLineIndex() === lineIndex ? 1 : 0
                }
                marginLeft={4}
              />
            </Rect>
          );
        })}
      </Layout>
    </Rect>,
  );

  yield* waitFor(0.4);

  for (let i = 1; i <= totalCharacters; i++) {
    typed(i);
    const currentChar = fullText[i - 1];
    const delay = currentChar === ' ' ? 0.12 : 0.08;
    yield* waitFor(delay);

    if (lineBreakStops.has(i)) {
      yield* waitFor(0.3);
    }
  }

  yield* waitFor(1.2);

  const sequence: CheckboxState[] = [
    'done',
    'inProgress',
    'cancelled',
    'error',
    'question',
    'unchecked',
  ];

  const cycleCheckboxByLine = function* (lineMatch: (line: string) => boolean) {
    const lineIndex = checklistLines.findIndex(lineMatch);
    if (lineIndex === -1) {
      return;
    }

    const checkboxIndices = checkboxIndicesByLine[lineIndex];
    if (checkboxIndices.length === 0) {
      return;
    }

    const targetSignal = checkboxStateSignals[checkboxIndices[0]];
    for (const state of sequence) {
      targetSignal(state);
      yield* waitFor(state === 'unchecked' ? 1 : 0.6);
    }
  };

  const cycleTargets: ((line: string) => boolean)[] = [
    (line) => line.includes('#todo install Obsidian Plus'),
    (line) => line.includes('capture reference screenshot'),
  ];

  for (const matcher of cycleTargets) {
    yield* cycleCheckboxByLine(matcher);
  }
});

