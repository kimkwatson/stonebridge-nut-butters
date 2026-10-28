const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(isMobile = true) {
  const handlers = {}, classes = new Set(), attributes = {};
  let mediaChange, focused = false;
  const button = { hidden: true, setAttribute: (name, value) => attributes[name] = value, focus: () => focused = true, addEventListener: (name, fn) => handlers['button:' + name] = fn };
  const nav = { inert: false, addEventListener: (name, fn) => handlers['nav:' + name] = fn };
  const header = { querySelector: selector => selector === '.menu-toggle' ? button : nav, contains: target => target === button || target === nav, classList: { add: name => classes.add(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } };
  const media = { matches: isMobile, addEventListener: (name, fn) => mediaChange = fn };
  vm.runInNewContext(fs.readFileSync('public/js/navigation.js', 'utf8'), { document: { querySelector: () => header, addEventListener: (name, fn) => handlers['document:' + name] = fn }, window: { matchMedia: () => media } });
  return { handlers, attributes, nav, button, classes, media, resize: () => mediaChange(), focused: () => focused };
}
test('mobile menu begins closed and inaccessible, then opens with updated semantics', () => {
  const state = setup();
  assert.equal(state.nav.inert, true);
  assert.equal(state.attributes['aria-expanded'], 'false');
  assert.equal(state.button.hidden, false);
  state.handlers['button:click']();
  assert.equal(state.nav.inert, false);
  assert.equal(state.attributes['aria-expanded'], 'true');
  assert.equal(state.attributes['aria-label'], 'Close navigation');
  assert.ok(state.classes.has('menu-open'));
});
test('Escape closes mobile menu and returns focus to its button', () => {
  const state = setup(); state.handlers['button:click']();
  state.handlers['document:keydown']({ key: 'Escape', preventDefault() {} });
  assert.equal(state.nav.inert, true);
  assert.equal(state.attributes['aria-expanded'], 'false');
  assert.ok(state.focused());
});
test('outside interactions and selecting a link close the mobile menu', () => {
  const state = setup(); state.handlers['button:click']();
  state.handlers['document:click']({ target: {} });
  assert.equal(state.nav.inert, true);
  state.handlers['button:click']();
  state.handlers['nav:click']({ target: { closest: () => ({}) } });
  assert.equal(state.nav.inert, true);
});
test('desktop navigation remains available after resizing from mobile', () => {
  const state = setup(); state.media.matches = false; state.resize();
  assert.equal(state.nav.inert, false);
  assert.equal(state.attributes['aria-expanded'], 'false');
  state.media.matches = true; state.resize();
  assert.equal(state.nav.inert, true);
});
