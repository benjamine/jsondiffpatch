function cloneRegExp(re: RegExp) {
  const regexMatch = /^\/(.*)\/([gimyu]*)$/.exec(re.toString())!;
  return new RegExp(regexMatch[1], regexMatch[2]);
}

export default function clone(arg: unknown): unknown {
  if (typeof arg !== 'object') {
    return arg;
  }
  if (arg === null) {
    return null;
  }
  if (Array.isArray(arg)) {
    return arg.map(clone);
  }
  if (arg instanceof Date) {
    return new Date(arg.getTime());
  }
  if (arg instanceof RegExp) {
    return cloneRegExp(arg);
  }
  const cloned = {};
  for (const name in arg) {
    if (Object.prototype.hasOwnProperty.call(arg, name)) {
      (cloned as Record<string, unknown>)[name] = clone(
        (arg as Record<string, unknown>)[name],
      );
    }
  }
  return cloned;
}
