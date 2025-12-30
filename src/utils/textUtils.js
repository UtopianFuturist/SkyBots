export const truncateText = (text, maxLength = 300) => {
  const segmenter = new Intl.Segmenter();
  const graphemes = [...segmenter.segment(text)].map(s => s.segment);

  if (graphemes.length <= maxLength) {
    return text;
  }

  // Truncate to the max length, leaving room for the ellipsis
  const truncatedGraphemes = graphemes.slice(0, maxLength - 1);
  let truncatedText = truncatedGraphemes.join('');

  // Find the last space to avoid cutting words
  const lastSpaceIndex = truncatedText.lastIndexOf(' ');
  if (lastSpaceIndex > 0) {
    truncatedText = truncatedText.slice(0, lastSpaceIndex);
  }

  return truncatedText + '…';
};

export const splitText = (text, maxLength = 290) => {
  const segmenter = new Intl.Segmenter();
  const graphemes = [...segmenter.segment(text)].map(s => s.segment);

  if (graphemes.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let currentChunk = '';

  for (const grapheme of graphemes) {
    if ((currentChunk + grapheme).length > maxLength) {
      // Find the last space to avoid cutting words
      const lastSpaceIndex = currentChunk.lastIndexOf(' ');
      if (lastSpaceIndex > 0) {
        chunks.push(currentChunk.slice(0, lastSpaceIndex) + '…');
        currentChunk = currentChunk.slice(lastSpaceIndex + 1);
      } else {
        chunks.push(currentChunk + '…');
        currentChunk = '';
      }
    }
    currentChunk += grapheme;
  }
  chunks.push(currentChunk);

  // Limit to 3 chunks as per the requirement
  return chunks.slice(0, 3);
};
