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
  colorSignal?: () => string;
}

const tagPalette: Record<string, string> = {
  todo: '#8f6bff',
  backlog: '#4ba3ff',
  tag: '#38bdf8',
  idea: '#facc15',
};

const defaultTagColor = '#94a3b8';

const checkboxFrameSize = 36;
const checkboxCircleSize = 30;

const checklistLines = [
  '- #idea use daily notes as control center for workflows',
  '    - use Obsidian Plus as a message service:',
  '        - integrate with external APIs',
  '        - pass messages between notebooks',
  '        - as a markdown-based no-code alternative',
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

  const rowHeight = 48;
  const columnGap = 6;
  const lineCount = tokenizedLines.length;
  const totalHeight = lineCount * rowHeight + (lineCount - 1) * columnGap;
  const firstLineCenter = -totalHeight / 2 + rowHeight / 2;
  const lineCenters = Array.from({length: lineCount}, (_, index) =>
    firstLineCenter + index * (rowHeight + columnGap),
  );

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

  const tagNameSignals = new Map<
    TokenWithRange & TagToken,
    SimpleSignal<string>
  >();
  const tagTextSignals = new Map<
    TokenWithRange & TagToken,
    SimpleSignal<string>
  >();

  for (const lineTokens of linesWithRanges) {
    for (const token of lineTokens) {
      if (token.type === 'tag') {
        const tagToken = token as TokenWithRange & TagToken;
        tagNameSignals.set(tagToken, createSignal(tagToken.tagName));
        tagTextSignals.set(tagToken, createSignal(tagToken.raw));
      }
    }
  }

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

    const lineTokens = linesWithRanges[index];
    const connectorTagToken = lineTokens.find(
      (token): token is TokenWithRange & TagToken => token.type === 'tag',
    );
    const connectorTagSignal = connectorTagToken
      ? tagNameSignals.get(connectorTagToken)
      : undefined;

    return {
      color: tagPalette[info.connectorTagName] ?? defaultTagColor,
      childIndices,
      colorSignal: connectorTagSignal
        ? () => tagPalette[connectorTagSignal()] ?? defaultTagColor
        : undefined,
    } satisfies ConnectorMeta;
  });

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

  const ideaTagToken = linesWithRanges
    .flat()
    .find(
      (token): token is TokenWithRange & TagToken =>
        token.type === 'tag' && token.tagName === 'idea',
    );

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

  const typed = createSignal(totalCharacters);
  const showTitle = createSignal(false);

  const caretVisible = () => false;
  const activeLineIndex = () => 0;

  const typedWithin = (token: TokenWithRange) => () =>
    Math.max(0, Math.min(token.length, typed() - token.start));

  const appendedCheckboxReveal = createSignal(0);
  const appendedCheckboxTyped = createSignal(0);
  const showTaskCheckboxIcon = createSignal(0);
  const taskCheckboxState = createSignal<CheckboxState>('unchecked');
  const timestampReveal = createSignal(0);

  const rootTagTextSignal = ideaTagToken
    ? tagTextSignals.get(ideaTagToken) ?? null
    : null;
  const rootTagNameSignal = ideaTagToken
    ? tagNameSignals.get(ideaTagToken) ?? null
    : null;
  const rootTagOriginalName = ideaTagToken?.tagName ?? 'idea';
  const rootTagTargetName = 'todo';

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

  const renderTokenNode = (
    token: TokenWithRange,
    lineIndex: number,
    {isMarker = false}: {isMarker?: boolean} = {},
  ) => {
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
      case 'tag': {
        const tagToken = token as TokenWithRange & TagToken;
        const tagNameSignal = tagNameSignals.get(tagToken);
        const tagTextSignal = tagTextSignals.get(tagToken);
        const textValue = () =>
          tagTextSignal ? tagTextSignal() : tagToken.raw;
        const tagNameValue = () =>
          tagNameSignal ? tagNameSignal() : tagToken.tagName;
        const visibleLength = () =>
          Math.min(Math.floor(portion()), textValue().length);
        const hasCharacters = () => visibleLength() > 0;
        const hasTagBody = () => tagNameValue().length > 0;
        const backgroundColor = () =>
          tagPalette[tagNameValue()] ?? defaultTagColor;

        return (
          <Rect
            layout
            direction={'row'}
            radius={() => (hasTagBody() ? 999 : 0)}
            fill={() => (hasTagBody() ? backgroundColor() : '#00000000')}
            padding={() =>
              hasTagBody() ? ([4, 12] as const) : ([0, 0] as const)
            }
            opacity={() => (hasCharacters() ? 1 : 0)}
            marginLeft={0}
          >
            <Txt
              text={() => textValue().slice(0, visibleLength())}
              fontFamily={'JetBrains Mono, Fira Code, monospace'}
              fontSize={30}
              fill={() => (hasTagBody() ? '#080b11' : '#d7deeb')}
            />
          </Rect>
        );
      }
      case 'space':
        return (
          <Rect width={() => (portion() > 0 ? token.width : 0)} height={1} />
        );
      case 'bullet': {
        const shouldHideBullet =
          lineIndex === 0 &&
          (appendedCheckboxReveal() > 0 ||
            appendedCheckboxTyped() > 0 ||
            showTaskCheckboxIcon() > 0);
        return (
          <Txt
            text={() => {
              if (shouldHideBullet) {
                return '';
              }
              return portion() < token.length
                ? token.raw.slice(0, portion())
                : '•';
            }}
            fontFamily={'JetBrains Mono, Fira Code, monospace'}
            fontSize={36}
            fill={'#d7deeb'}
            marginRight={isMarker ? 0 : 4}
          />
        );
      }
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
      <Layout direction={'column'} padding={48} gap={0} alignItems={'start'}>
        <Txt
          text={'Daily Notes'}
          fontFamily={'Inter, sans-serif'}
          fontSize={40}
          fill={'#9da8ba'}
          opacity={() => (showTitle() ? 1 : 0)}
          height={() => (showTitle() ? 48 : 0)}
          marginBottom={() => (showTitle() ? columnGap : 0)}
        />
        <Layout direction={'column'} gap={columnGap} alignItems={'start'}>
          {splitLines.map(({indentTokens, markerToken, contentTokens}, lineIndex) => {
          const connector = connectors[lineIndex];
          const appendedCheckboxWidth = () =>
            lineIndex === 0
              ? checkboxFrameSize * appendedCheckboxReveal()
              : 0;
          const isAppendedCheckboxActive = () =>
            lineIndex === 0 &&
            (appendedCheckboxReveal() > 0 ||
              appendedCheckboxTyped() > 0 ||
              showTaskCheckboxIcon() > 0);
          const markerWidth =
            markerToken?.type === 'checkbox'
              ? checkboxFrameSize
              : markerToken?.type === 'bullet'
              ? 28
              : 0;
          const markerPortion = markerToken ? typedWithin(markerToken) : null;
          const markerWidthValue = () => {
            const appendedWidth = appendedCheckboxWidth();
            if (lineIndex === 0 && appendedWidth > 0) {
              return appendedWidth;
            }
            if (!markerToken || !markerPortion) {
              return appendedWidth;
            }
            const typedCount = Math.max(0, markerPortion());
            if (typedCount >= markerToken.length) {
              return Math.max(markerWidth, appendedWidth);
            }
            const estimated = typedCount * 12;
            return Math.max(Math.min(markerWidth, estimated), appendedWidth);
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
              {indentTokens.map((token) => renderTokenNode(token, lineIndex))}
              {(markerToken || connector || lineIndex === 0) && (
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
                      fill={connector.colorSignal ?? (() => connector.color)}
                      y={() => connectorPlacement().offset}
                      height={() => connectorPlacement().height}
                      opacity={() =>
                        connectorPlacement().height > 0 ? 1 : 0
                      }
                    />
                  )}
                  {lineIndex === 0 && (
                    <Rect
                      layout
                      justifyContent={'center'}
                      alignItems={'center'}
                      width={appendedCheckboxWidth}
                      height={checkboxFrameSize}
                    >
                      <Txt
                        text={() => {
                          const typedAmount = Math.min(
                            3,
                            Math.round(appendedCheckboxTyped()),
                          );
                          return '[ ]'.slice(0, typedAmount);
                        }}
                        fontFamily={'JetBrains Mono, Fira Code, monospace'}
                        fontSize={36}
                        fill={'#d7deeb'}
                        opacity={() => Math.max(0, 1 - showTaskCheckboxIcon())}
                      />
                      {renderCheckboxIcon(
                        taskCheckboxState,
                        () =>
                          Math.min(
                            showTaskCheckboxIcon(),
                            appendedCheckboxReveal(),
                          ),
                      )}
                    </Rect>
                  )}
                  {markerToken &&
                    (!isAppendedCheckboxActive()) &&
                    renderTokenNode(markerToken, lineIndex, {isMarker: true})}
                </Rect>
              )}
              {contentTokens.map((token) => renderTokenNode(token, lineIndex))}
              {lineIndex === 0 && (
                <Txt
                  text={'✅ 2025-10-22'}
                  fontFamily={'JetBrains Mono, Fira Code, monospace'}
                  fontSize={30}
                  fill={'#94f2b5'}
                  marginLeft={24}
                  opacity={timestampReveal}
                />
              )}
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
      </Layout>
    </Rect>,
  );

  yield* waitFor(0.8);

  if (rootTagTextSignal) {
    const deletionDelay = 0.08;
    for (let remaining = rootTagOriginalName.length; remaining >= 0; remaining--) {
      const nextBody = rootTagOriginalName.slice(0, remaining);
      rootTagTextSignal(`#${nextBody}`);
      if (rootTagNameSignal) {
        rootTagNameSignal(nextBody);
      }
      const isFinalStep = remaining === 0;
      yield* waitFor(isFinalStep ? 0.18 : deletionDelay);
    }
  }

  if (rootTagTextSignal) {
    const insertionDelay = 0.08;
    for (let index = 1; index <= rootTagTargetName.length; index++) {
      const nextBody = rootTagTargetName.slice(0, index);
      rootTagTextSignal(`#${nextBody}`);
      if (rootTagNameSignal) {
        rootTagNameSignal(nextBody);
      }
      const isFinalStep = index === rootTagTargetName.length;
      yield* waitFor(isFinalStep ? 0.2 : insertionDelay);
    }
  }

  yield* waitFor(0.4);

  yield* appendedCheckboxReveal(1, 0.3);
  yield* waitFor(0.1);
  yield* appendedCheckboxTyped(3, 0.4);
  yield* waitFor(0.1);
  yield* showTaskCheckboxIcon(1, 0.3);

  yield* waitFor(0.5);

  const statusSequence: CheckboxState[] = [
    'inProgress',
    'cancelled',
    'error',
    'question',
    'done',
  ];

  for (const status of statusSequence) {
    taskCheckboxState(status);
    if (status === 'done') {
      yield* waitFor(0.2);
    } else {
      yield* waitFor(0.6);
    }
  }

  yield* timestampReveal(1, 0.4);

  yield* waitFor(1.4);
});

