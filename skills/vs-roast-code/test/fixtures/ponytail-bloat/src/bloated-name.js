const get = require('lodash/get');

class NameFormatterFactory {
  create() {
    return {
      format(profile) {
        return get(profile, 'name', '').trim();
      },
    };
  }
}

function displayName(profile) {
  return new NameFormatterFactory().create().format(profile);
}

module.exports = { displayName };
