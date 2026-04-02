// Logical grid state — tracks occupancy and positions.
// Entirely independent of three.js visuals.
export class GridState {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._positions = new Map(); // id → { x, y }
    this._occupancy = new Map(); // 'x,y' → id
  }

  place(id, x, y) {
    if (this._occupancy.has(`${x},${y}`)) return false;
    this._positions.set(id, { x, y });
    this._occupancy.set(`${x},${y}`, id);
    return true;
  }

  move(id, x, y) {
    if (this._occupancy.has(`${x},${y}`)) return false;
    const prev = this._positions.get(id);
    if (prev) this._occupancy.delete(`${prev.x},${prev.y}`);
    this._positions.set(id, { x, y });
    this._occupancy.set(`${x},${y}`, id);
    return true;
  }

  remove(id) {
    const pos = this._positions.get(id);
    if (pos) this._occupancy.delete(`${pos.x},${pos.y}`);
    this._positions.delete(id);
  }

  getPosition(id) {
    return this._positions.get(id) ?? null;
  }

  getAt(x, y) {
    return this._occupancy.get(`${x},${y}`) ?? null;
  }

  isOccupied(x, y) {
    return this._occupancy.has(`${x},${y}`);
  }

  // Chebyshev distance (diagonals count as 1).
  getDistance(id1, id2) {
    const a = this._positions.get(id1);
    const b = this._positions.get(id2);
    if (!a || !b) return Infinity;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  // All valid adjacent tile coordinates (8-directional).
  getAdjacentPositions(x, y) {
    const result = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          result.push({ x: nx, y: ny });
        }
      }
    }
    return result;
  }
}
