$(head -n 37 ch_temp.js)
  if (lowerText.startsWith("!research")) {
    const query = lowerText.replace("!research", "").trim();
    if (!query) return "Please provide a research topic.";
    bot.performSpecialistResearchProject(query);
    return `Initializing specialist research project on: "${query}". I will report findings once complete.`;
  }

  if (lowerText === '!help') {
$(tail -n +39 ch_temp.js)
