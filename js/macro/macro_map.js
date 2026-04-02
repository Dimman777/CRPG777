export class MacroMap {
  constructor(width, height) {
    this.width  = width;
    this.height = height;
    this._cells = new Array(width * height).fill(null);
  }

  _idx(x, y)      { return y * this.width + x; }
  inBounds(x, y)  { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
  get(x, y)       { return this.inBounds(x, y) ? this._cells[this._idx(x, y)] : null; }
  set(x, y, cell) { if (this.inBounds(x, y)) this._cells[this._idx(x, y)] = cell; }

  forEach(fn) {
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        fn(this._cells[this._idx(x, y)], x, y);
  }

  neighbors4(x, y) {
    return [[-1,0],[1,0],[0,-1],[0,1]]
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => this.inBounds(nx, ny))
      .map(([nx, ny]) => ({ x: nx, y: ny, cell: this.get(nx, ny) }));
  }

  neighbors8(x, y) {
    const result = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dy) && this.inBounds(x + dx, y + dy))
          result.push({ x: x + dx, y: y + dy, cell: this.get(x + dx, y + dy) });
    return result;
  }

  findAll(predicate) {
    const result = [];
    this.forEach((cell, x, y) => { if (predicate(cell, x, y)) result.push({ x, y, cell }); });
    return result;
  }

  // Count cells matching a predicate
  count(predicate) {
    let n = 0;
    for (const cell of this._cells) if (cell && predicate(cell)) n++;
    return n;
  }
}
