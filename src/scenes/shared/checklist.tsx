import {Circle, Layout, Line, Rect, Txt} from '@motion-canvas/2d';

export type CheckboxState =
  | 'unchecked'
  | 'done'
  | 'inProgress'
  | 'cancelled'
  | 'error'
  | 'question';

export type MarkerType = 'bullet' | 'checkbox' | null;

export interface TextSegment {
  type: 'text';
  text: string;
}

export interface TagSegment {
  type: 'tag';
  raw: string;
  tagName: string;
  recognized: boolean;
  color?: string;
}

export interface LinkSegment {
  type: 'link';
  alias: string;
  url: string;
}

export type Segment = TextSegment | TagSegment | LinkSegment;

export interface ConnectorInfo {
  height: number;
  offset: number;
  color: string;
}

export interface ParsedLine {
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

export interface ChecklistLayoutConfig {
  rowHeight: number;
  columnGap: number;
  indentSpaceWidth: number;
}

export interface ParsedDocument {
  lines: ParsedLine[];
  lineCenters: number[];
  layout: ChecklistLayoutConfig;
}

export const tagPalette: Record<string, string> = {
  application: '#34d399',
  todo: '#8f6bff',
  backlog: '#4ba3ff',
  tag: '#38bdf8',
  idea: '#facc15',
};

export const defaultTagColor = '#94a3b8';

export const checkboxFrameSize = 36;
export const checkboxCircleSize = 30;

export const defaultLayoutConfig: ChecklistLayoutConfig = {
  rowHeight: 48,
  columnGap: 6,
  indentSpaceWidth: 16,
};

export const checkboxCharToState: Record<string, CheckboxState> = {
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

export interface RenderCheckboxOptions {
  visibility?: number | (() => number);
  marginRight?: number;
}

export type CheckboxStateSource = CheckboxState | (() => CheckboxState);

export function renderCheckboxIcon(
  state: CheckboxStateSource,
  options: RenderCheckboxOptions = {},
) {
  const resolveState =
    typeof state === 'function' ? (state as () => CheckboxState) : () => state;
  const visibilityOption = options.visibility;
  const resolveVisibility: () => number =
    typeof visibilityOption === 'function'
      ? visibilityOption
      : () => (visibilityOption ?? 1);
  const marginRight = options.marginRight ?? 0;

  const baseFill = () => {
    switch (resolveState()) {
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
    switch (resolveState()) {
      case 'unchecked':
        return '#cbd5f5';
      case 'inProgress':
        return '#fbbf24';
      default:
        return baseFill();
    }
  };

  const strokeWidth = () => {
    switch (resolveState()) {
      case 'unchecked':
      case 'inProgress':
        return 4;
      default:
        return 0;
    }
  };

  return (
    <Rect
      layout
      justifyContent={'center'}
      alignItems={'center'}
      width={checkboxFrameSize}
      height={checkboxFrameSize}
      opacity={resolveVisibility}
      marginRight={marginRight}
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
        opacity={() => (resolveState() === 'done' ? 1 : 0)}
      />
      <Rect
        layout={false}
        width={18}
        height={4}
        radius={2}
        fill={'#e2e8f0'}
        opacity={() => (resolveState() === 'cancelled' ? 1 : 0)}
      />
      <Rect
        layout={false}
        x={-1}
        justifyContent={'center'}
        alignItems={'center'}
        opacity={() => (resolveState() === 'error' ? 1 : 0)}
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
        opacity={() => (resolveState() === 'question' ? 1 : 0)}
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
        fill={'#0f1218'}
        startAngle={-60}
        endAngle={9}
        closed
        opacity={() => (resolveState() === 'inProgress' ? 1 : 0)}
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
}

export function parseSegments(content: string): Segment[] {
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

    if (content[index] === '[') {
      const aliasEnd = content.indexOf(']', index + 1);
      if (aliasEnd !== -1 && content[aliasEnd + 1] === '(') {
        const urlEnd = content.indexOf(')', aliasEnd + 2);
        if (urlEnd !== -1) {
          const alias = content.slice(index + 1, aliasEnd);
          const url = content.slice(aliasEnd + 2, urlEnd);
          segments.push({
            type: 'link',
            alias,
            url,
          });
          index = urlEnd + 1;
          continue;
        }
      }
    }

    let end = index + 1;
    while (end < content.length && content[end] !== '#' && content[end] !== '[') {
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

export function parseLine(rawLine: string): ParsedLine {
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

export interface ParseDocumentOptions {
  layout?: Partial<ChecklistLayoutConfig>;
}

export function parseDocument(
  lines: string[],
  options: ParseDocumentOptions = {},
): ParsedDocument {
  const layout: ChecklistLayoutConfig = {
    ...defaultLayoutConfig,
    ...options.layout,
  };

  const parsedLines = lines.map(parseLine);
  const lineCount = parsedLines.length;
  const {rowHeight, columnGap} = layout;
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

  return {
    lines: parsedLines,
    lineCenters,
    layout,
  } satisfies ParsedDocument;
}

export interface BuildDocumentNodesOptions {
  checkboxMarginRight?: number;
  bulletMarginRight?: number;
  keyPrefix?: string;
}

export function buildDocumentNodes(
  document: ParsedDocument,
  options: BuildDocumentNodesOptions = {},
) {
  const {rowHeight, indentSpaceWidth} = document.layout;
  const checkboxMarginRight = options.checkboxMarginRight ?? 0;
  const bulletMarginRight = options.bulletMarginRight ?? 0;
  const keyPrefix = options.keyPrefix ?? 'document';

  return document.lines.map((line, lineIndex) => {
    const markerWidth =
      line.marker === 'checkbox'
        ? checkboxFrameSize
        : line.marker === 'bullet'
        ? checkboxFrameSize
        : 0;
    const connectorWidth = line.connector ? 4 : 0;
    const markerColumnWidth = Math.max(markerWidth, connectorWidth);
    const indentWidth = line.indentSpaces * indentSpaceWidth;

    return (
      <Rect
        key={`${keyPrefix}-line-${lineIndex}`}
        layout
        direction={'row'}
        alignItems={'center'}
        height={rowHeight}
      >
        {indentWidth > 0 && (
          <Rect layout width={indentWidth} height={rowHeight} fill={'#00000000'} />
        )}
        {(markerColumnWidth > 0 || line.connector) && (
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
                marginRight={bulletMarginRight}
              />
            )}
            {line.marker === 'checkbox' &&
              renderCheckboxIcon(line.checkboxState ?? 'unchecked', {
                marginRight: checkboxMarginRight,
              })}
          </Rect>
        )}
        <Rect layout direction={'row'} alignItems={'center'}>
          {line.segments.map((segment, segmentIndex) => {
            if (segment.type === 'text') {
              if (segment.text.trim().length === 0) {
                return (
                  <Rect
                    key={`${keyPrefix}-segment-${lineIndex}-${segmentIndex}`}
                    width={segment.text.length * indentSpaceWidth}
                    height={1}
                  />
                );
              }

              return (
                <Txt
                  key={`${keyPrefix}-segment-${lineIndex}-${segmentIndex}`}
                  text={segment.text}
                  fontFamily={'JetBrains Mono, Fira Code, monospace'}
                  fontSize={36}
                  fill={'#d7deeb'}
                />
              );
            }

          if (segment.type === 'link') {
            return (
              <Layout
                key={`${keyPrefix}-segment-${lineIndex}-${segmentIndex}`}
                layout
                direction={'row'}
                alignItems={'center'}
                gap={10}
              >
                <Txt
                  text={'🔗'}
                  fontFamily={'Inter, sans-serif'}
                  fontSize={34}
                  fill={'#60a5fa'}
                />
                <Layout layout direction={'column'} alignItems={'start'} gap={6}>
                  <Txt
                    text={segment.alias}
                    fontFamily={'JetBrains Mono, Fira Code, monospace'}
                    fontSize={36}
                    fill={'#0060df'}
                  />
                  <Rect
                    layout
                    width={segment.alias.length * 20}
                    height={4}
                    radius={2}
                    fill={'#1d4ed8'}
                  />
                </Layout>
              </Layout>
            );
          }

            const showPill = segment.recognized && segment.tagName.length > 0;
            if (!showPill) {
              return (
                <Txt
                  key={`${keyPrefix}-segment-${lineIndex}-${segmentIndex}`}
                  text={segment.raw}
                  fontFamily={'JetBrains Mono, Fira Code, monospace'}
                  fontSize={36}
                  fill={'#d7deeb'}
                />
              );
            }

            return (
              <Rect
                key={`${keyPrefix}-segment-${lineIndex}-${segmentIndex}`}
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
          })}
        </Rect>
      </Rect>
    );
  });
}
