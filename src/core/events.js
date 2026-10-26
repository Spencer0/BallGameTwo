// Minimal event bus.
export class Events {
  constructor() {
    this.map = new Map();
  }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const arr = this.map.get(name);
    if (!arr) return;
    const k = arr.indexOf(fn);
    if (k >= 0) arr.splice(k, 1);
  }
  emit(name, data) {
    const arr = this.map.get(name);
    if (!arr) return;
    for (let k = 0; k < arr.length; k++) arr[k](data);
  }
}
