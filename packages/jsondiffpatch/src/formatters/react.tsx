import React, { useState, useEffect } from 'react';
import { diff } from '../index.js';
import HTMLFormatter from './html.js';
import type { Delta } from '../types.js';
import './styles/html.css';

type ReactFormatterType = {
  oldJson: unknown;
  newJson?: unknown;
  initallyShowDiff?: boolean;
};

const ReactFormatterComponent: React.FC<ReactFormatterType> = ({
  oldJson,
  newJson,
  initallyShowDiff,
}) => {
  const [showDiffOnly, setShowDiffOnly] = useState(initallyShowDiff);

  const delta: Delta = diff(oldJson, newJson);
  if (!delta) {
    return <></>;
  }
  const htmlDiff = new HTMLFormatter().format(delta, oldJson);
  const createMarkupHtml = () =>
    (({ __html: htmlDiff }) || '') as { __html: TrustedHTML };

  return (
    <div
      className={`json-diff-container ${
        showDiffOnly ? 'jsondiffpatch-unchanged-hidden' : ''
      }`}
    >
      <div dangerouslySetInnerHTML={createMarkupHtml()}></div>
    </div>
  );
};

export default ReactFormatterComponent;
