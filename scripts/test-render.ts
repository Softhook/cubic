import { chromium } from 'playwright';
import { cardSvg } from '../packages/art/src/card';
import regolithCards from '../packages/engine/src/regolith/cards.json';
import * as fs from 'fs';
import * as path from 'path';

const outDir = '/Users/softhook/.gemini/antigravity/brain/59368352-e7d4-44c4-b91c-c77397521099/scratch';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 600 } });

  const cardData = regolithCards.skills.find((c: any) => c.id === 'r-tactical')!;
  const face = {
    ...cardData,
    deck: 'skill' as const,
    copies: cardData.count,
    index: 1,
    deckSize: 20,
    look: 'screenprint' as const,
  };
  const svg = cardSvg(face, { rounded: true });
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0; background:#333; display:flex; justify-content:center; align-items:center; height:100vh;"><div style="width:300px;">${svg}</div></body></html>`,
  );
  await page.screenshot({ path: path.join(outDir, 'r-tactical-after.png') });

  await browser.close();
  console.log('Rendered r-tactical-after.png');
}

main().catch(console.error);
