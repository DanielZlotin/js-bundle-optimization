!(function (r) {
  'use strict';
  r.require = t, r.__d = function (r, t, i) {
    if (t in e) return;
    e[t] = { dependencyMap: i, exports: void 0, factory: r, hasError: !1, isInitialized: !1 }
  };

  var e = Object.create(null);

  function t(t) {
    var n = t, o = e[n];
    return o && o.isInitialized ? o.exports : (function (e, t) {
      if (!i && r.ErrorUtils) {
        i = !0;
        var n = void 0;
        try { n = a(e, t) } catch (e) { r.ErrorUtils.reportFatalError(e) } return i = !1, n
      }
      return a(e, t)
    })(n, o)
  }

  t.async = function (r) { return Promise.resolve().then(function () { return t(r) }) };

  var i = !1;

  var n = 16, o = -1 >>> n;

  function a(i, a) {
    var u = r.nativeRequire;
    !a && u && (u(i & o, i >>> n), a = e[i]);
    if (!a) throw Error('Requiring unknown module "' + i + '".');
    if (a.hasError) throw (function (r, e) { return Error('Requiring module "' + r + '", which threw an exception: ' + e) })(i, a.error);
    a.isInitialized = !0;
    var c = a.exports = {}, s = a, d = s.factory, f = s.dependencyMap;
    try {
      var l = { exports: c };
      return d(r, t, l, c, f), a.factory = void 0, a.dependencyMap = void 0, a.exports = l.exports
    } catch (r) { throw a.hasError = !0, a.error = r, a.isInitialized = !1, a.exports = void 0, r }
  }
})('undefined' != typeof global ? global : 'undefined' != typeof self ? self : this);

__d(function (e, r, t, c) {
  'use strict';
  var i = new (r(23));
  Object.defineProperty(e, '__fbBatchedBridge', { configurable: !0, value: i }), t.exports = i
}, 22);
