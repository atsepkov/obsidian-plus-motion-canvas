import {Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {SimpleSignal, createSignal, waitFor} from '@motion-canvas/core';

import {
  CheckboxState,
  checkboxCharToState,
  checkboxFrameSize,
  defaultTagColor,
  renderCheckboxIcon,
  tagPalette,
} from './shared/checklist';

type TokenType = 'checkbox' | 'tag' | 'text' | 'space' | 'bullet';

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

const checklistLines = [
  '- #idea use daily notes as control center for workflows',
  '    - use Obsidian Plus as a message service:',
  '        - integrate with external APIs',
  '        - pass messages between notebooks',
  '        - as a markdown-based no-code alternative',
];

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

  const fullText = linesWithRanges.flat().map((token) => token.raw).join('');

  const pauseStops = new Map<number, number>();
  const ideaTagToken = linesWithRanges
    .flat()
    .find(
      (token): token is TokenWithRange & TagToken =>
        token.type === 'tag' && token.tagName === 'idea',
    );
  if (ideaTagToken) {
    pauseStops.set(ideaTagToken.end, 0.6);
  }

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
  const showTitle = createSignal(false);

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
                renderCheckboxIcon(checkboxStateSignals[token.checkboxIndex], {
                  visibility: () => (portion() >= token.length ? 1 : 0),
                })}
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
                      fill={connector.colorSignal ?? (() => connector.color)}
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
      </Layout>
    </Rect>,
  );

  yield* waitFor(0.4);

  for (let i = 1; i <= totalCharacters; i++) {
    typed(i);
    const currentChar = fullText[i - 1];
    const delay = currentChar === ' ' ? 0.12 : 0.08;
    yield* waitFor(delay);

    if (pauseStops.has(i)) {
      yield* waitFor(pauseStops.get(i)!);
    }

    if (lineBreakStops.has(i)) {
      yield* waitFor(0.3);
    }
  }

  yield* waitFor(1.2);
});

