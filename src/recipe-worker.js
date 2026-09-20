import * as P from './primitives.js';
self.onmessage = ({data: m}) => {
  try {
    let result;
    if (m.kind === 'components') result = P.components(m.data, m.w, m.h, m.options);
    else if (m.kind === 'swap') result = P.swap(m.data, m.w, m.h, m.options);
    else if (m.kind === 'texture') result = P.mapTexture(m.data, m.w, m.h, m.options);
    else if (m.kind === 'mask') result = P.packChannels(m.inputs, m.w, m.h, m.options.mapping);
    else if (m.kind === 'extrude') result = P.extrude(m.data, m.w, m.h, m.options.cellW, m.options.cellH, m.options.padding);
    else if (m.kind === 'margin') result = P.marginBounds(m.data, m.w, m.h, m.options.threshold, m.options.padding);
    else throw Error('Unknown primitive');
    const buffer = result?.buffer || result?.data?.buffer;
    self.postMessage({result}, buffer ? [buffer] : []);
  } catch (error) { self.postMessage({error: error.message}); }
};
