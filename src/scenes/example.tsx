import {Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {createSignal, waitFor} from '@motion-canvas/core';

type TokenType = 'checkbox' | 'tag' | 'text' | 'space' | 'bullet';

interface BaseToken {
  type: TokenType;
  raw: string;
  length: number;
}

interface CheckboxToken extends BaseToken {
  type: 'checkbox';
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
  endIndex: number;
  firstChildIndex: number;
  maxHeight: number;
}

const tagPalette: Record<string, string> = {
  todo: '#8f6bff',
  backlog: '#4ba3ff',
  tag: '#38bdf8',
};

const defaultTagColor = '#94a3b8';

const checklistLines = [
  '- [ ] #todo install Obsidian Plus',
  '    - additional context',
  '    - random bullet with a #tag',
  '    - [ ] capture reference screenshot',
  '- [ ] #backlog research plugin API',
];

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < line.length) {
    const current = line[index];

    const checkboxPrefix = '- [ ]';
    if (line.slice(index, index + checkboxPrefix.length) === checkboxPrefix) {
      tokens.push({
        type: 'checkbox',
        raw: checkboxPrefix,
        length: checkboxPrefix.length,
      });
      index += checkboxPrefix.length;
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
          ? 28
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

  const checkboxPrefix = '- [ ]';

  let remainder = rawLine.slice(indentSpaces);
  let marker: MarkerType = null;

  if (remainder.startsWith(checkboxPrefix)) {
    marker = 'checkbox';
    remainder = remainder.slice(checkboxPrefix.length);
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

export default makeScene2D(function* (view) {
  const lineAnalyses = checklistLines.map(analyzeLine);
  const tokenizedLines = checklistLines.map(tokenizeLine);

  const rowHeight = 56;
  const columnGap = 24;
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
    let endIndex = lineCount;
    for (let j = index + 1; j < lineCount; j++) {
      const potentialChild = lineAnalyses[j];
      if (potentialChild.indentLevel <= info.indentLevel) {
        endIndex = j;
        break;
      }
      childIndices.push(j);
    }

    if (childIndices.length === 0) {
      return null;
    }

    const boundaryCenter =
      endIndex < lineCount
        ? lineCenters[endIndex] - rowHeight / 2
        : lineCenters[lineCount - 1] + rowHeight / 2;

    const maxHeight = Math.max(0, boundaryCenter - lineCenters[index]);

    return {
      color: tagPalette[info.connectorTagName] ?? defaultTagColor,
      childIndices,
      endIndex,
      firstChildIndex: childIndices[0],
      maxHeight,
    } satisfies ConnectorMeta;
  });

  let runningTotal = 0;
  const linesWithRanges: TokenWithRange[][] = tokenizedLines.map((lineTokens, lineIndex) =>
    lineTokens.map((token) => {
      const start = runningTotal;
      const end = start + token.length;
      runningTotal = end;
      return {
        ...token,
        start,
        end,
        lineIndex,
      };
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

  const splitLineTokens = (lineTokens: TokenWithRange[]) => {
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
  };

  const renderTokenNode = (token: TokenWithRange, isMarker = false) => {
    const portion = typedWithin(token);

    switch (token.type) {
      case 'checkbox':
        return (
          <Txt
            text={() =>
              portion() < token.length ? token.raw.slice(0, portion()) : '◯'
            }
            fontFamily={'JetBrains Mono, Fira Code, monospace'}
            fontSize={() => (portion() < token.length ? 36 : 44)}
            fill={'#d7deeb'}
            marginRight={isMarker ? 0 : 4}
          />
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
        {linesWithRanges.map((lineTokens, lineIndex) => {
          const {indentTokens, markerToken, contentTokens} =
            splitLineTokens(lineTokens);
          const connector = connectors[lineIndex];
          const markerWidth =
            markerToken?.type === 'checkbox'
              ? 44
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
          const connectorHeight = () =>
            connector && typed() >= lineRanges[connector.firstChildIndex].start
              ? connector.maxHeight
              : 0;

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
                      y={() => connectorHeight() / 2}
                      height={() => connectorHeight()}
                      opacity={() => (connectorHeight() > 0 ? 1 : 0)}
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
});

