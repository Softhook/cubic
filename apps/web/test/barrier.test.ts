import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarrierBubble } from '../src/components/board/BarrierWeb';

describe('BarrierBubble', () => {
  it('renders a barrier group with defs, fused patch, body, and specular highlights', () => {
    const html = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(BarrierBubble, { r: 2, c: 3, x: 100, y: 150, cell: 80, mm: 1.2, cast: true, world: 'mars' }),
      ),
    );

    expect(html).toContain('class="barrier"');
    expect(html).toContain('transform="translate(100 150)"');
    expect(html).toContain('id="barrier-b-2-3-body"');
    expect(html).toContain('id="barrier-b-2-3-caustic"');
    expect(html).toContain('id="barrier-b-2-3-fresnel"');
    expect(html).toContain('id="barrier-b-2-3-spec"');
    expect(html).toContain('<title>A barrier: nothing moves, drops or shoots through it</title>');
  });

  it('renders cast shadow and optical caustic hotspot when cast is true on ground', () => {
    const html = renderToStaticMarkup(
      createElement('svg', null, createElement(BarrierBubble, { r: 1, c: 4, x: 50, y: 50, cell: 80, mm: 1, cast: true, world: 'mars' })),
    );
    expect(html).toContain('url(#barrier-b-1-4-caustic)');
  });

  it('omits ground cast shadow when cast is false in space', () => {
    const html = renderToStaticMarkup(
      createElement('svg', null, createElement(BarrierBubble, { r: 0, c: 2, x: 50, y: 50, cell: 80, mm: 1, cast: false })),
    );
    expect(html).not.toContain('url(#barrier-b-0-2-caustic)');
  });

  it('applies world-specific mineral tints', () => {
    const phobosHtml = renderToStaticMarkup(
      createElement('svg', null, createElement(BarrierBubble, { r: 0, c: 0, x: 0, y: 0, cell: 80, mm: 1, cast: true, world: 'phobos' })),
    );
    const marsHtml = renderToStaticMarkup(
      createElement('svg', null, createElement(BarrierBubble, { r: 0, c: 0, x: 0, y: 0, cell: 80, mm: 1, cast: true, world: 'mars' })),
    );

    // Phobos uses cold quartz rim #d2e8ff, Mars uses pale amber rim #ffe3c2
    expect(phobosHtml).toContain('#d2e8ff');
    expect(marsHtml).toContain('#ffe3c2');
  });
});
