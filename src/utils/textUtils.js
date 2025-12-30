export const truncateText = (text, maxLength = 300) => {
  if ([...new Intl.Segmenter().segment(text)].length <= maxLength) {
    return text;
  }

  // Find the last space within the maxLength
  let truncated = text.slice(0, maxLength - 1);
  let lastSpace = truncated.lastIndexOf(' ');

  // If a space is found, truncate there to avoid cutting words
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }

  return truncated + '…';
};
