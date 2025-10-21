import {Layout, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {createSignal, waitFor} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  // Customize the tag color here to match your Obsidian theme.
  const tagColor = '#8f6bff';

  const prefix = '- [ ] ';
  const tag = '#todo';
  const suffix = ' install Obsidian Plus';
  const totalText = prefix + tag + suffix;
  const totalLength = totalText.length;

  const typed = createSignal(0);

  const typedPrefix = () => Math.min(prefix.length, Math.floor(typed()));
  const typedTag = () =>
    Math.min(tag.length, Math.max(0, Math.floor(typed()) - prefix.length));
  const typedSuffix = () =>
    Math.min(
      suffix.length,
      Math.max(0, Math.floor(typed()) - prefix.length - tag.length),
    );
  const caretVisible = () => Math.floor(typed()) < totalLength;

  const renderedPrefix = () => {
    const count = typedPrefix();
    if (count <= 0) {
      return '';
    }

    const typedChars = prefix.slice(0, count).split('');
    typedChars[0] = '•';

    if (count >= 5) {
      typedChars.splice(2, Math.min(3, typedChars.length - 2), '☐');
    }

    return typedChars.join('');
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
      <Layout direction={'column'} padding={48} gap={24}>
        <Txt
          text={'Daily Notes'}
          fontFamily={'Inter, sans-serif'}
          fontSize={40}
          fill={'#9da8ba'}
        />
        <Layout direction={'row'} gap={0} alignItems={'center'}>
          <Txt
            text={renderedPrefix}
            fontFamily={'JetBrains Mono, Fira Code, monospace'}
            fontSize={36}
            fill={'#d7deeb'}
          />
          <Rect
            layout
            direction={'row'}
            radius={999}
            fill={tagColor}
            padding={() => (typedTag() > 0 ? [6, 12] : [0, 0])}
            opacity={() => (typedTag() > 0 ? 1 : 0)}
          >
            <Txt
              text={() => tag.slice(0, typedTag())}
              fontFamily={'JetBrains Mono, Fira Code, monospace'}
              fontSize={30}
              fill={'#080b11'}
            />
          </Rect>
          <Txt
            text={() => suffix.slice(0, typedSuffix())}
            fontFamily={'JetBrains Mono, Fira Code, monospace'}
            fontSize={36}
            fill={'#d7deeb'}
          />
          <Rect
            width={4}
            height={40}
            fill={'#cbd5f5'}
            opacity={() => (caretVisible() ? 1 : 0)}
          />
        </Layout>
      </Layout>
    </Rect>,
  );

  for (let i = 1; i <= totalLength; i++) {
    typed(i);
    const currentChar = totalText[i - 1];
    const delay = currentChar === ' ' ? 0.12 : 0.08;
    yield* waitFor(delay);
  }

  yield* waitFor(1.2);
});
