import { describe, expect, it } from 'vitest';
import { projectReachableRange } from '../reachableRangeProjection';

describe('rzutowanie mapy zasięgu i trasy', () => {
  it('umieszcza pracodawcę na końcu geometrii zwróconej przez trasę', () => {
    const route = [
      { lat: 52.2297, lon: 21.0122 },
      { lat: 52.2500, lon: 20.9800 },
      { lat: 52.3000, lon: 20.9500 },
    ];
    const projection = projectReachableRange(
      route[0],
      [{ lat: 52.2, lon: 20.9 }, { lat: 52.4, lon: 21.1 }, { lat: 52.3, lon: 21.15 }],
      route,
    );

    expect(projection.route.split(' ')).toHaveLength(route.length);
    expect(projection.destination).toEqual({
      x: Number(projection.route.split(' ').at(-1)?.split(',')[0]),
      y: Number(projection.route.split(' ').at(-1)?.split(',')[1]),
    });
    expect(projection.destination).not.toEqual({ x: projection.center.x + 85, y: projection.center.y - 45 });
  });

  it('nie tworzy pinezki pracodawcy ani linii bez geometrii trasy', () => {
    const projection = projectReachableRange(
      { lat: 52.2297, lon: 21.0122 },
      [{ lat: 52.2, lon: 20.9 }, { lat: 52.4, lon: 21.1 }, { lat: 52.3, lon: 21.15 }],
    );

    expect(projection.route).toBe('');
    expect(projection.destination).toBeNull();
  });

  it('pomija całą trasę, gdy choć jeden punkt ma nieprawidłowe współrzędne', () => {
    const projection = projectReachableRange(
      { lat: 52.2297, lon: 21.0122 },
      [],
      [{ lat: 52.2, lon: 21.0 }, { lat: Number.NaN, lon: 20.9 }],
    );

    expect(projection.route).toBe('');
    expect(projection.destination).toBeNull();
  });
});
