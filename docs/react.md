# How to render in a react

This is a popular question so decided to add a section with different approaches.

## 1. Use a react wrapper component

[jsondiffpatch-react](https://github.com/bluepeter/jsondiffpatch-react)

this package implements a react component ready to use in your react app, using jsondiffpatch as a dependency

## 2. Write your own

you might want more control or pick the exact version of jsondiffpatch, here's a JSX code example:

```tsx
import { create } from 'jsondiffpatch';
import { format } from 'jsondiffpatch/formatters/html';
import 'jsondiffpatch/formatters/styles/html.css';

export const JsonDiffPatch = ({
  left,
  right,
  diffOptions,
  hideUnchangedValues,
}: {
  left: unknown;
  right: unknown;
  diffOptions?: Parameters<typeof create>[0];
  hideUnchangedValues?: boolean;
}) => {
  // note: you might to useMemo here (especially if these are immutable objects)
  const jsondiffpatch = create(diffOptions || {});
  const delta = diff(left, right);
  const htmlDiff = format(delta, oldJson);
  return (
    <div
      className={`json-diff-container ${
        hideUnchangedValues ? 'jsondiffpatch-unchanged-hidden' : ''
      }`}
    >
      <div
        dangerouslySetInnerHTML={() =>
          ({ __html: htmlDiff || '' }) as { __html: TrustedHTML }
        }
      ></div>
    </div>
  );
};

export default ReactFormatterComponent;
```
