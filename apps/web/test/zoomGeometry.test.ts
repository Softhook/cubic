/** The board zoom's geometry: fitting, the zoom limits, keeping the map on screen, and zooming around a point. */
import { describe, expect, it } from 'vitest';
import { canZoom, centredOn, fitted, frame, place, rubber, softCell, zoomAround } from '../src/components/board/zoomGeometry';

// A Moto G55 upright: a 9×9 map in the space above the bottom sheet.
const phone = frame(404, 560, 9, 9);

describe('frame', () => {
  it('fits the whole board, and zooms in to 80px spaces', () => {
    expect(phone.fit).toBe(44);
    expect(phone.max).toBe(80);
    expect(canZoom(phone)).toBe(true);
  });

  it("doesn't zoom where the spaces are nearly big enough already", () => {
    const desk = frame(700, 700, 9, 9); // 77px spaces
    expect(desk.max).toBe(desk.fit);
    expect(canZoom(desk)).toBe(false);
    expect(softCell(desk, 200)).toBe(desk.fit);
  });
});

describe('place', () => {
  it('centres the board along an axis it fits in', () => {
    expect(fitted(phone)).toEqual({ cell: 44, x: 4, y: 82 });
    expect(place(phone, 44, -50, 300)).toEqual(fitted(phone));
  });

  it('keeps a zoomed board covering the wrap', () => {
    // 720px of board in 404px: x between -316 and 0.
    expect(place(phone, 80, 100, 0).x).toBe(0);
    expect(place(phone, 80, -999, 0).x).toBe(404 - 720);
    expect(place(phone, 80, -100, -50)).toEqual({ cell: 80, x: -100, y: -50 });
  });

  it('gives a little past the edges under a finger, never as far as it was pulled', () => {
    const pulled = place(phone, 80, 100, 0, true);
    expect(pulled.x).toBeGreaterThan(0);
    expect(pulled.x).toBeLessThan(100);
    expect(rubber(0, 404)).toBe(0);
    expect(rubber(1e6, 404)).toBeLessThan(404);
    expect(rubber(-50, 404)).toBe(-rubber(50, 404));
  });
});

describe('zooming', () => {
  it('keeps the point it zooms around where it is', () => {
    const from = place(phone, 60, -100, -100);
    const to = zoomAround(phone, from, 1.2, 200, 250);
    // The board point under (200, 250) before is still under it after.
    expect((200 - to.x) / to.cell).toBeCloseTo((200 - from.x) / from.cell);
    expect((250 - to.y) / to.cell).toBeCloseTo((250 - from.y) / from.cell);
  });

  it('stops at the fitted size and at 80px spaces', () => {
    expect(zoomAround(phone, fitted(phone), 0.5, 200, 200)).toEqual(fitted(phone));
    expect(zoomAround(phone, fitted(phone), 10, 200, 200).cell).toBe(80);
  });

  it('pinched past the limits, gives less and less', () => {
    expect(softCell(phone, 60)).toBe(60);
    expect(softCell(phone, 160)).toBeGreaterThan(80);
    expect(softCell(phone, 160)).toBeLessThan(100);
    expect(softCell(phone, 22)).toBeLessThan(44);
    expect(softCell(phone, 22)).toBeGreaterThan(35);
  });

  it('centres on a space as far as the edges allow', () => {
    const mid = centredOn(phone, 80, 4, 4);
    expect(mid.x + 4.5 * 80).toBe(202);
    expect(mid.y + 4.5 * 80).toBe(280);
    expect(centredOn(phone, 80, 0, 0)).toEqual({ cell: 80, x: 0, y: 0 });
  });
});
