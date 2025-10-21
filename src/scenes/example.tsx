import {Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {createSignal, waitFor} from '@motion-canvas/core';

type TokenType = 'checkbox' | 'tag' | 'text' | 'space';

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

type Token = CheckboxToken | TagToken | TextToken | SpaceToken;

type TokenWithRange = Token & {
  start: number;
  end: number;
  lineIndex: number;
};

interface LineRange {
  start: number;
  end: number;
}

const tagPalette: Record<string, string> = {
  todo: '#8f6bff',
  backlog: '#4ba3ff',
};

const defaultTagColor = '#94a3b8';

const checklistLines = [
  '- [ ] #todo install Obsidian Plus',
  '- [ ] #backlog research plugin API',
];

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  const checkboxPrefix = '- [ ]';
  if (line.startsWith(checkboxPrefix)) {
    tokens.push({
      type: 'checkbox',
      raw: checkboxPrefix,
      length: checkboxPrefix.length,
    });
    index = checkboxPrefix.length;
  }

  while (index < line.length) {
    const current = line[index];

    if (current === ' ') {
      let end = index + 1;
      while (end < line.length && line[end] === ' ') {
        end++;
      }
      const raw = line.slice(index, end);
      const previousToken = tokens[tokens.length - 1];
      const baseWidth = previousToken?.type === 'checkbox' ? 28 : 16;
      tokens.push({
        type: 'space',
        raw,
        length: raw.length,
        width: baseWidth * raw.length,
      });
      index = end;
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

export default makeScene2D(function* (view) {
  const tokenizedLines = checklistLines.map(tokenizeLine);

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
      <Layout direction={'column'} padding={48} gap={24}>
        <Txt
          text={'Daily Notes'}
          fontFamily={'Inter, sans-serif'}
          fontSize={40}
          fill={'#9da8ba'}
        />
        {linesWithRanges.map((lineTokens, lineIndex) => (
          <Layout direction={'row'} gap={0} alignItems={'center'}>
            {lineTokens.map((token) => {
              const portion = typedWithin(token);
              switch (token.type) {
                case 'checkbox':
                  return (
                    <Txt
                      text={() =>
                        portion() < token.length
                          ? token.raw.slice(0, portion())
                          : '◯'
                      }
                      fontFamily={'JetBrains Mono, Fira Code, monospace'}
                      fontSize={() => (portion() < token.length ? 36 : 44)}
                      fill={'#d7deeb'}
                    />
                  );
                case 'tag':
                  return (
                    <Rect
                      layout
                      direction={'row'}
                      radius={999}
                      fill={() =>
                        tagPalette[token.tagName] ?? defaultTagColor
                      }
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
                    <Rect
                      width={() => (portion() > 0 ? token.width : 0)}
                      height={1}
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
            })}
            <Rect
              width={4}
              height={40}
              fill={'#cbd5f5'}
              opacity={() =>
                caretVisible() && activeLineIndex() === lineIndex ? 1 : 0
              }
            />
          </Layout>
        ))}
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

