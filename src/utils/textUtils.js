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
