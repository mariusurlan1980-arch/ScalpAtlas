export function calculateStatistics(history = []) {
  const total = history.length;
  const buy = history.filter(x => x.signal === 'BUY').length;
  const sell = history.filter(x => x.signal === 'SELL').length;
  const averageProbability = total
    ? Math.round(history.reduce((sum, x) => sum + Number(x.probability || 0), 0) / total)
    : 0;
  const countBy = key => Object.entries(history.reduce((acc, item) => {
    const value = item[key] || 'Necunoscut';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  return { total, buy, sell, averageProbability, patterns: countBy('pattern'), timeframes: countBy('timeframe') };
}

export function calculateJournalStatistics(journal = []) {
  const wins = journal.filter(x => x.outcome === 'WIN').length;
  const losses = journal.filter(x => x.outcome === 'LOSS').length;
  const total = wins + losses;
  return { total, wins, losses, winRate: total ? Math.round(wins / total * 100) : 0 };
}
