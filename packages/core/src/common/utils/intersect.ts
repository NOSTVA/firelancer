function many(sets: any[][]): any[] {
  const o: Record<string | number, number> = {};
  const l = sets.length - 1;
  const first = sets[0];
  const last = sets[l];

  // Initialize the map with keys from the first set
  for (const item of first) {
    o[item] = 0;
  }

  // Update the map based on each subsequent set
  for (let i = 1; i <= l; i++) {
    const row = sets[i];
    for (const key of row) {
      if (o[key] === i - 1) {
        o[key] = i;
      }
    }
  }

  // Collect the result from the last set
  const a: any[] = [];
  for (const key of last) {
    if (o[key] === l) {
      a.push(key);
    }
  }

  return a;
}

function intersect<T>(a: T[], b?: T[]): T[] {
  if (!b) {
    return many(a as any[][]);
  }

  const res: T[] = [];
  for (const item of a) {
    if (indexOf(b, item) > -1) {
      res.push(item);
    }
  }
  return res;
}

intersect.big = function <T>(a: T[], b?: T[]): T[] {
  if (!b) {
    return many(a as any[][]);
  }

  const ret: T[] = [];
  const temp: Record<string | number, boolean> = {};

  for (const item of b) {
    temp[item as any] = true;
  }
  for (const item of a) {
    if (temp[item as any]) {
      ret.push(item);
    }
  }

  return ret;
};

function indexOf<T>(arr: T[], el: T): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === el) {
      return i;
    }
  }
  return -1;
}

export default intersect;
export { intersect };
