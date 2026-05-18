class UnsafeSuggestionFilter {
  filter(suggestion) {
    const unsafe = ['rm -rf', 'DROP TABLE', 'DELETE FROM', 'curl remote'];
    return {
      safe: !unsafe.some(u => suggestion.includes(u)),
      blocked: unsafe.filter(u => suggestion.includes(u)),
    };
  }
}

module.exports = { UnsafeSuggestionFilter };
