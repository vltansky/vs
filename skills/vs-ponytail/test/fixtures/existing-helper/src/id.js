let nextId = 100;

function newId() {
  nextId += 1;
  return `order-${nextId}`;
}

module.exports = { newId };
