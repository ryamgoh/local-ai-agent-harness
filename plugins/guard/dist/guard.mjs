import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/boundary@2.0.0/node_modules/boundary/lib/index.js
var require_lib = __commonJS({
  "../../node_modules/.pnpm/boundary@2.0.0/node_modules/boundary/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.binarySearch = exports.upperBound = exports.lowerBound = exports.compare = void 0;
    function compare(v1, v2) {
      return v1 < v2;
    }
    exports.compare = compare;
    function upperBound(array, value, comp = compare) {
      let len = array.length;
      let i = 0;
      while (len) {
        let diff = len >>> 1;
        let cursor = i + diff;
        if (comp(value, array[cursor])) {
          len = diff;
        } else {
          i = cursor + 1;
          len -= diff + 1;
        }
      }
      return i;
    }
    exports.upperBound = upperBound;
    function lowerBound(array, value, comp = compare) {
      let len = array.length;
      let i = 0;
      while (len) {
        let diff = len >>> 1;
        let cursor = i + diff;
        if (comp(array[cursor], value)) {
          i = cursor + 1;
          len -= diff + 1;
        } else {
          len = diff;
        }
      }
      return i;
    }
    exports.lowerBound = lowerBound;
    function binarySearch(array, value, comp = compare) {
      let cursor = lowerBound(array, value, comp);
      return cursor !== array.length && !comp(value, array[cursor]);
    }
    exports.binarySearch = binarySearch;
  }
});

// ../../node_modules/.pnpm/structured-source@4.0.0/node_modules/structured-source/lib/structured-source.js
var require_structured_source = __commonJS({
  "../../node_modules/.pnpm/structured-source@4.0.0/node_modules/structured-source/lib/structured-source.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StructuredSource = void 0;
    var boundary_1 = require_lib();
    var StructuredSource2 = class {
      /**
       * @constructs StructuredSource
       * @param {string} source - source code text.
       */
      constructor(source) {
        this.indice = [0];
        let regexp = /[\r\n\u2028\u2029]/g;
        const length = source.length;
        regexp.lastIndex = 0;
        while (true) {
          let result = regexp.exec(source);
          if (!result) {
            break;
          }
          let index = result.index;
          if (source.charCodeAt(index) === 13 && source.charCodeAt(index + 1) === 10) {
            index += 1;
          }
          let nextIndex = index + 1;
          if (length < nextIndex) {
            break;
          }
          this.indice.push(nextIndex);
          regexp.lastIndex = nextIndex;
        }
      }
      get line() {
        return this.indice.length;
      }
      /**
       * @param {SourceLocation} loc - location indicator.
       * @return {[ number, number ]} range.
       */
      locationToRange(loc) {
        return [this.positionToIndex(loc.start), this.positionToIndex(loc.end)];
      }
      /**
       * @param {[ number, number ]} range - pair of indice.
       * @return {SourceLocation} location.
       */
      rangeToLocation(range) {
        return {
          start: this.indexToPosition(range[0]),
          end: this.indexToPosition(range[1])
        };
      }
      /**
       * @param {SourcePosition} pos - position indicator.
       * @return {number} index.
       */
      positionToIndex(pos) {
        let start = this.indice[pos.line - 1];
        return start + pos.column;
      }
      /**
       * @param {number} index - index to the source code.
       * @return {SourcePosition} position.
       */
      indexToPosition(index) {
        const startLine = (0, boundary_1.upperBound)(this.indice, index);
        return {
          line: startLine,
          column: index - this.indice[startLine - 1]
        };
      }
    };
    exports.StructuredSource = StructuredSource2;
  }
});

// ../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS({
  "../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// ../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/common.js
var require_common = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug2(...args) {
          if (!debug2.enabled) {
            return;
          }
          const self2 = debug2;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self2.diff = ms;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        debug2.namespace = namespace;
        debug2.useColors = createDebug.useColors();
        debug2.color = createDebug.selectColor(namespace);
        debug2.extend = extend;
        debug2.destroy = createDebug.destroy;
        Object.defineProperty(debug2, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug2);
        }
        return debug2;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// ../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// ../../node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "../../node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js"(exports, module) {
    "use strict";
    module.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// ../../node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "../../node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js"(exports, module) {
    "use strict";
    var os = __require("os");
    var tty = __require("tty");
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// ../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/node.js
var require_node = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug2) {
      debug2.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug2.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// ../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/index.js
var require_src = __commonJS({
  "../../node_modules/.pnpm/debug@4.4.3_supports-color@7.2.0/node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DEFAULT_MAX_EXTGLOB_RECURSION = 0;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      __proto__: null,
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      DEFAULT_MAX_EXTGLOB_RECURSION,
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        __proto__: null,
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    exports.basename = (path2, { windows } = {}) => {
      const segs = path2.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.tokens === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              let parens = 0;
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  advance();
                  continue;
                }
                if (code === CHAR_LEFT_PARENTHESES) {
                  parens++;
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES && --parens === 0) {
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            let parens = 1;
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_BACKWARD_SLASH) {
                backslashes = token.backslashes = true;
                advance();
                continue;
              }
              if (code === CHAR_LEFT_PARENTHESES) {
                parens++;
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES && --parens === 0) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n2 = prevIndex !== void 0 ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value2 = input.slice(n2, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value2;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (i >= start) {
            parts.push(value2);
            prevIndex = i;
          }
        }
        const n = prevIndex !== void 0 ? prevIndex + 1 : start;
        const value = input.slice(n);
        parts.push(value);
        if (opts.tokens && prevIndex && prevIndex + 1 < input.length) {
          tokens[tokens.length - 1].value = value;
          depth(tokens[tokens.length - 1]);
          state.maxDepth += tokens[tokens.length - 1].depth;
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants2 = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants2;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var splitTopLevel = (input) => {
      const parts = [];
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let value = "";
      let escaped = false;
      for (const ch of input) {
        if (escaped === true) {
          value += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          value += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          value += ch;
          continue;
        }
        if (quote === 0) {
          if (ch === "[") {
            bracket++;
          } else if (ch === "]" && bracket > 0) {
            bracket--;
          } else if (bracket === 0) {
            if (ch === "(") {
              paren++;
            } else if (ch === ")" && paren > 0) {
              paren--;
            } else if (ch === "|" && paren === 0) {
              parts.push(value);
              value = "";
              continue;
            }
          }
        }
        value += ch;
      }
      parts.push(value);
      return parts;
    };
    var isPlainBranch = (branch) => {
      let escaped = false;
      for (const ch of branch) {
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (/[?*+@!()[\]{}]/.test(ch)) {
          return false;
        }
      }
      return true;
    };
    var normalizeSimpleBranch = (branch) => {
      let value = branch.trim();
      let changed = true;
      while (changed === true) {
        changed = false;
        if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
          value = value.slice(2, -1);
          changed = true;
        }
      }
      if (!isPlainBranch(value)) {
        return;
      }
      return value.replace(/\\(.)/g, "$1");
    };
    var hasRepeatedCharPrefixOverlap = (branches) => {
      const values = branches.map(normalizeSimpleBranch).filter(Boolean);
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a = values[i];
          const b = values[j];
          const char = a[0];
          if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {
            continue;
          }
          if (a === b || a.startsWith(b) || b.startsWith(a)) {
            return true;
          }
        }
      }
      return false;
    };
    var parseRepeatedExtglob = (pattern, requireEnd = true) => {
      if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") {
        return;
      }
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let escaped = false;
      for (let i = 1; i < pattern.length; i++) {
        const ch = pattern[i];
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          continue;
        }
        if (quote === 1) {
          continue;
        }
        if (ch === "[") {
          bracket++;
          continue;
        }
        if (ch === "]" && bracket > 0) {
          bracket--;
          continue;
        }
        if (bracket > 0) {
          continue;
        }
        if (ch === "(") {
          paren++;
          continue;
        }
        if (ch === ")") {
          paren--;
          if (paren === 0) {
            if (requireEnd === true && i !== pattern.length - 1) {
              return;
            }
            return {
              type: pattern[0],
              body: pattern.slice(2, i),
              end: i
            };
          }
        }
      }
    };
    var buildCharClassStar = (chars) => {
      const source = chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`;
      return `${source}*`;
    };
    var getStarExtglobSequenceChars = (pattern) => {
      let index = 0;
      const chars = [];
      while (index < pattern.length) {
        const match = parseRepeatedExtglob(pattern.slice(index), false);
        if (!match || match.type !== "*") {
          return;
        }
        const branches = splitTopLevel(match.body).map((branch2) => branch2.trim());
        if (branches.length !== 1) {
          return;
        }
        const branch = normalizeSimpleBranch(branches[0]);
        if (!branch || branch.length !== 1) {
          return;
        }
        chars.push(branch);
        index += match.end + 1;
      }
      if (chars.length < 1) {
        return;
      }
      return chars;
    };
    var repeatedExtglobRecursion = (pattern) => {
      let depth = 0;
      let value = pattern.trim();
      let match = parseRepeatedExtglob(value);
      while (match) {
        depth++;
        value = match.body.trim();
        match = parseRepeatedExtglob(value);
      }
      return depth;
    };
    var analyzeRepeatedExtglob = (body, options) => {
      if (options.maxExtglobRecursion === false) {
        return { risky: false };
      }
      const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants2.DEFAULT_MAX_EXTGLOB_RECURSION;
      const branches = splitTopLevel(body).map((branch) => branch.trim());
      if (branches.length > 1) {
        if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) {
          return { risky: true };
        }
      }
      const safeChars = [];
      let sawStarSequence = false;
      let combinable = true;
      for (const branch of branches) {
        const chars = getStarExtglobSequenceChars(branch);
        if (chars) {
          sawStarSequence = true;
          safeChars.push(...chars);
          continue;
        }
        const literal = normalizeSimpleBranch(branch);
        if (literal && literal.length === 1) {
          safeChars.push(literal);
          continue;
        }
        combinable = false;
        if (repeatedExtglobRecursion(branch) > max) {
          return { risky: true };
        }
      }
      if (sawStarSequence) {
        return combinable ? { risky: true, safeOutput: buildCharClassStar([...new Set(safeChars)]) } : { risky: true };
      }
      return { risky: false };
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants2.globChars(opts.windows);
      const EXTGLOB_CHARS = constants2.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        token.startIndex = state.index;
        token.tokensIndex = tokens.length;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        const literal = input.slice(token.startIndex, state.index + 1);
        const body = input.slice(token.startIndex + 2, state.index);
        const analysis = analyzeRepeatedExtglob(body, opts);
        if ((token.type === "plus" || token.type === "star") && analysis.risky) {
          const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
          const open = tokens[token.tokensIndex];
          open.type = "text";
          open.value = literal;
          open.output = safeOutput || utils.escapeRegex(literal);
          for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
            tokens[i].value = "";
            tokens[i].output = "";
            delete tokens[i].suffix;
          }
          state.output = token.output + open.output;
          state.backtrack = true;
          push({ type: "paren", extglob: true, value, output: "" });
          decrement("parens");
          return;
        }
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE[rest2];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          const isEnd = eos() || state.parens > 0 && rest === ")".repeat(state.parens) && !extglobs.some((extglob) => extglob.type === "negate");
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && isEnd) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants2.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants2 = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch2 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch2(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = opts.windows;
      const regex = isState ? picomatch2.compileRe(glob, options) : picomatch2.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch2(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch2.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch2.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch2.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch2.matchBase = (input, glob, options, posix = options && options.windows) => {
      const regex = glob instanceof RegExp ? glob : picomatch2.makeRe(glob, options);
      return regex.test(utils.basename(input, { windows: posix }));
    };
    picomatch2.isMatch = (str, patterns, options) => picomatch2(patterns, options)(str);
    picomatch2.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch2.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch2.scan = (input, options) => scan(input, options);
    picomatch2.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch2.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch2.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch2.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch2.constants = constants2;
    module.exports = picomatch2;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch2(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch2, pico);
    module.exports = picomatch2;
  }
});

// src/guard.mjs
import {
  readFileSync,
  mkdirSync,
  appendFileSync,
  openSync,
  closeSync,
  fstatSync,
  fchmodSync,
  constants,
  realpathSync
} from "node:fs";
import { join, resolve, dirname, basename, normalize } from "node:path";
import { createHash } from "node:crypto";

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/SecretLintSourceCodeImpl.js
var import_structured_source = __toESM(require_structured_source(), 1);

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/helper/invariant.js
function invariant(condition, message) {
  if (!condition)
    throw new Error(message);
}

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/SecretLintSourceCodeImpl.js
var SecretLintSourceCodeImpl = class {
  hasBOM;
  content;
  filePath;
  physicalFilePath;
  contentType;
  ext;
  structuredSource;
  constructor({ content = "", ext, filePath, physicalFilePath, contentType }) {
    invariant(ext || filePath, "should be set either of fileExt or filePath.");
    this.hasBOM = content.charCodeAt(0) === 65279;
    this.content = this.hasBOM ? content.slice(1) : content;
    this.structuredSource = new import_structured_source.StructuredSource(this.content);
    this.filePath = filePath;
    this.physicalFilePath = physicalFilePath;
    this.contentType = contentType;
    this.ext = ext;
  }
  /**
   * get file path
   * This return `undefined` if the source code is created without file path.
   * For example, use core API to create a source code directly.
   *
   * You can use this path to detect file type.
   * However, if you want to read the file content, use `getPhysicalFilePath` instead.
   * @returns {string|undefined}
   */
  getFilePath() {
    return this.filePath;
  }
  /**
   * get physical file path
   * This return `undefined` if the source code is not related to file.
   * For example, the source code is given from the stdin.
   *
   * You can use this path to read the file content.
   */
  getPhysicalFilePath() {
    return this.physicalFilePath;
  }
  /**
   * @param {SecretLintSourceNodeLocation} loc - location indicator.
   * @return {[ number, number ]} range.
   */
  locationToRange(loc) {
    return this.structuredSource.locationToRange(loc);
  }
  /**
   * @param {[ number, number ]} range - pair of indice.
   * @return {SecretLintSourceNodeLocation} location.
   */
  rangeToLocation(range) {
    const location = this.structuredSource.rangeToLocation(range);
    return {
      start: {
        line: location.start.line,
        column: location.start.column
      },
      end: {
        line: location.end.line,
        column: location.end.column
      }
    };
  }
  /**
   * @param {Position} pos - position indicator.
   * @return {number} index.
   */
  positionToIndex(pos) {
    return this.structuredSource.positionToIndex(pos);
  }
  /**
   * @param {number} index - index to the source code.
   * @return {Position} position.
   */
  indexToPosition(index) {
    const position = this.structuredSource.indexToPosition(index);
    return {
      line: position.line,
      column: position.column
    };
  }
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/helper/promise-event-emitter.js
var EventEmitter = class {
  #listeners = /* @__PURE__ */ new Map();
  on(type, listener) {
    const prevSet = this.#listeners.get(type);
    const listenerSet = prevSet ?? /* @__PURE__ */ new Set();
    listenerSet?.add(listener);
    this.#listeners.set(type, listenerSet);
  }
  emit(type, ...args) {
    const listenerSet = this.#listeners.get(type);
    if (!listenerSet) {
      return;
    }
    for (const listenerSetElement of listenerSet) {
      listenerSetElement(...args);
    }
  }
  off(type, listener) {
    const listenerSet = this.#listeners.get(type);
    if (!listenerSet) {
      return;
    }
    for (const listenerSetElement of listenerSet) {
      if (listenerSetElement === listener) {
        listenerSet.delete(listener);
      }
    }
  }
  removeAllListeners() {
    this.#listeners.clear();
  }
  listenerCount(type) {
    return this.#listeners.get(type)?.size ?? 0;
  }
  listeners(type) {
    return Array.from(this.#listeners.get(type) ?? []);
  }
};
var PromiseEventEmitter = class {
  events;
  constructor() {
    this.events = new EventEmitter();
  }
  listenerCount(type) {
    return this.events.listenerCount(type);
  }
  on(event, listener) {
    return this.events.on(event, listener);
  }
  emit(event, ...args) {
    const promises = [];
    this.events.listeners(event).forEach((listener) => {
      promises.push(listener(...args));
    });
    return Promise.all(promises);
  }
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/helper/SecretLintRuleMessageTranslator.js
var DEFAULT_LOCAL = "en";
var formatMessage = (messageHandler, props) => {
  if (typeof props !== "object" || props === null) {
    return messageHandler();
  }
  return messageHandler(props);
};
var getMatchedLocaleMessage = (locale, locales) => {
  const localKeys = Object.keys(locales);
  const matchLocale = localKeys.find((key) => {
    return key === locale;
  });
  if (matchLocale) {
    return matchLocale;
  }
  const [lang] = locale.split("-");
  if (!lang) {
    return DEFAULT_LOCAL;
  }
  const fallbackMatchLocal = localKeys.find((key) => {
    return key === lang;
  });
  if (fallbackMatchLocal) {
    return fallbackMatchLocal;
  }
  return DEFAULT_LOCAL;
};
var createTranslator = (messages2, options) => {
  return (messageId, props) => {
    const messageHandler = messages2[messageId];
    if (!messageHandler) {
      throw new Error(`messages:${String(messageId)} is missing in messages.`);
    }
    if (typeof messageHandler === "function") {
      if (typeof messageId !== "string") {
        throw new Error(`message's key:${String(messageId)} should be string`);
      }
      return {
        message: formatMessage(messageHandler, props),
        messageId,
        data: props
      };
    }
    const defaultLocal = options && options.defaultLocale ? options.defaultLocale : DEFAULT_LOCAL;
    const locale = getMatchedLocaleMessage(defaultLocal, messageHandler);
    const localizedMessage = messageHandler[locale];
    if (!localizedMessage) {
      if (messageHandler[DEFAULT_LOCAL]) {
        throw new Error(`messages${String(messageId)}.${locale} is missing in messages.`);
      }
      throw new Error(`message's key:${String(messageId)}.${DEFAULT_LOCAL} should be defined in messages.`);
    }
    if (typeof messageId !== "string") {
      throw new Error(`message's key:${String(messageId)}.${DEFAULT_LOCAL} should be string`);
    }
    return {
      message: formatMessage(localizedMessage, props),
      messageId,
      data: props
    };
  };
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/RuleContext.js
var createContextEvents = () => {
  const contextEvents = new EventEmitter();
  const REPORT_SYMBOL = /* @__PURE__ */ Symbol("report");
  const IGNORE_SYMBOL = /* @__PURE__ */ Symbol("ignore");
  return {
    report(descriptor) {
      contextEvents.emit(REPORT_SYMBOL, descriptor);
    },
    onReport(handler) {
      const listener = (descriptor) => {
        handler(descriptor);
      };
      contextEvents.on(REPORT_SYMBOL, listener);
      return () => {
        contextEvents.off(REPORT_SYMBOL, listener);
      };
    },
    ignore(descriptor) {
      contextEvents.emit(IGNORE_SYMBOL, descriptor);
    },
    onIgnore(handler) {
      const listener = (descriptor) => {
        handler(descriptor);
      };
      contextEvents.on(IGNORE_SYMBOL, listener);
      return () => {
        contextEvents.off(IGNORE_SYMBOL, listener);
      };
    }
  };
};
var createRuleContext = ({ ruleId, ruleParentId, meta, severity, sourceCode, contextEvents, sharedOptions, locale }) => {
  return {
    sharedOptions,
    createTranslator: (messages2) => {
      return createTranslator(messages2, {
        defaultLocale: locale
      });
    },
    ignore(descriptor) {
      const { message } = descriptor.message;
      contextEvents.ignore({
        type: "ignore",
        ruleId,
        ruleParentId,
        range: descriptor.range,
        targetRuleId: descriptor.targetRuleId,
        loc: sourceCode.rangeToLocation(descriptor.range),
        message
      });
    },
    report(descriptor) {
      const { message, messageId, data } = descriptor.message;
      const severityLevel = severity ?? "error";
      if (ruleParentId) {
        contextEvents.report({
          ...descriptor,
          type: "message",
          ruleId,
          ruleParentId,
          loc: sourceCode.rangeToLocation(descriptor.range),
          severity: severityLevel,
          message,
          messageId,
          docsUrl: meta.docs?.url ? `${meta.docs.url}#${messageId}` : void 0,
          data
        });
      } else {
        contextEvents.report({
          ...descriptor,
          type: "message",
          ruleId,
          loc: sourceCode.rangeToLocation(descriptor.range),
          severity: severityLevel,
          message,
          messageId,
          docsUrl: meta.docs?.url ? `${meta.docs.url}#${messageId}` : void 0,
          data
        });
      }
    }
  };
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/SecretLintRuleImpl.js
var SecretLintRule = class {
  ruleReportHandle;
  ruleCreator;
  descriptorRule;
  constructor({ descriptorRule, context }) {
    this.descriptorRule = descriptorRule;
    this.ruleCreator = descriptorRule.rule;
    const ruleCreatorOptions = descriptorRule.options || {};
    this.ruleReportHandle = this.ruleCreator.create(context, ruleCreatorOptions);
  }
  allowMessageIds() {
    if (!this.descriptorRule.allowMessageIds) {
      return [];
    }
    const ruleId = this.ruleCreator.meta.id;
    return this.descriptorRule.allowMessageIds.map((allowMessageId) => {
      return {
        messageId: allowMessageId,
        ruleId
      };
    });
  }
  supportSourceCode(sourceCode) {
    const contentType = sourceCode.contentType;
    if (contentType === "unknown") {
      return true;
    }
    if (this.ruleCreator.meta.supportedContentTypes.includes("all")) {
      return true;
    }
    return this.ruleCreator.meta.supportedContentTypes.includes(contentType);
  }
  async file(source) {
    const file = this.ruleReportHandle.file;
    if (!file) {
      return;
    }
    return file(source);
  }
};

// ../../node_modules/.pnpm/@secretlint+profiler@13.1.0/node_modules/@secretlint/profiler/module/index.js
var SecretLintProfiler = class {
  perf;
  PerformanceObserver;
  observer;
  /**
   * Profiling costs performance.
   * `performance.mark()` and `PerformanceObserver` callback are called for each rule and each file.
   * So, the profiler should be disabled if the user does not need the profiling result.
   * https://github.com/secretlint/secretlint/issues/1633
   */
  enabled;
  entries = [];
  measures = [];
  /**
   * Set of mark names that have already been marked as `{mark}::start`
   */
  startMarkNames = /* @__PURE__ */ new Set();
  executionPromises = [];
  constructor(options) {
    this.perf = options.perf;
    this.PerformanceObserver = options.PerformanceObserver;
    this.enabled = options.enabled ?? true;
  }
  get isEnabled() {
    return this.enabled;
  }
  /**
   * Enable or Disable the profiler.
   * If the profiler is disabled, `mark()` does nothing and collected entries are cleared.
   * @param enabled
   */
  setEnabled(enabled) {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (!enabled) {
      this.stopObserving();
    }
  }
  startObserving() {
    const pattern = /(.*?)::end(\|\|.*)?/;
    const observer = new this.PerformanceObserver((items) => {
      if (!this.enabled) {
        return;
      }
      const entries = items.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === "mark") {
          const match = entry.name.match(pattern);
          const endIdentifier = match ? match[1] : void 0;
          const suffix = match && match[2] ? match[2] : "";
          if (endIdentifier) {
            const startMarkName = `${endIdentifier}::start${suffix}`;
            if (this.startMarkNames.has(startMarkName)) {
              this.executionPromises.push(Promise.resolve().then(() => {
                this.perf.measure(endIdentifier + suffix, startMarkName, entry.name);
              }));
            }
          } else {
            this.startMarkNames.add(entry.name);
          }
          this.entries.push(entry);
        } else if (entry.entryType === "measure") {
          this.measures.push(entry);
        }
      });
    });
    observer.observe({ entryTypes: ["mark", "measure"] });
    this.observer = observer;
  }
  stopObserving() {
    this.observer?.disconnect();
    this.observer = void 0;
    this.entries.length = 0;
    this.measures.length = 0;
    this.executionPromises.length = 0;
    this.startMarkNames.clear();
  }
  mark(marker) {
    if (!this.enabled) {
      return;
    }
    if (!this.observer) {
      this.startObserving();
    }
    if ("id" in marker) {
      this.perf.mark(`${marker.type}||${marker.id}`);
    } else {
      this.perf.mark(marker.type);
    }
  }
  waifForExecutionPromises = () => {
    return Promise.all(this.executionPromises).finally(() => {
      this.executionPromises.length = 0;
    });
  };
  async getEntries() {
    await this.waifForExecutionPromises();
    return this.entries;
  }
  async getMeasures() {
    await this.waifForExecutionPromises();
    return this.measures;
  }
};

// ../../node_modules/.pnpm/@secretlint+profiler@13.1.0/node_modules/@secretlint/profiler/module/node.js
import perf_hooks from "node:perf_hooks";
var NullPerformanceObserver = class {
  disconnect() {
  }
  observe(_options) {
  }
};
var secretLintProfiler = new SecretLintProfiler({
  perf: perf_hooks.performance,
  PerformanceObserver: perf_hooks.PerformanceObserver ? perf_hooks.PerformanceObserver : NullPerformanceObserver
});

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/RunningEvents.js
var createRunningEvents = () => {
  const contextEvents = new PromiseEventEmitter();
  const registerSet = /* @__PURE__ */ new Set();
  const LINT_HANDLE = /* @__PURE__ */ Symbol("lint:start");
  const rules2 = [];
  return {
    collectAllowMessageIds() {
      const allowMessageIds = [];
      rules2.forEach((rule) => {
        allowMessageIds.push(...rule.allowMessageIds());
      });
      return allowMessageIds;
    },
    /**
     * Start to run linting
     * @param options
     */
    runLint(options) {
      return contextEvents.emit(LINT_HANDLE, options);
    },
    registerRule({ descriptorRule, context }) {
      if (registerSet.has(descriptorRule.id)) {
        throw new Error(`rule.id:${descriptorRule.id} is already registered.
                
Duplicated rule.id is something wrong in .secretlintrc.                
`);
      }
      registerSet.add(descriptorRule.id);
      const rule = new SecretLintRule({
        descriptorRule,
        context
      });
      rules2.push(rule);
      contextEvents.on(LINT_HANDLE, async ({ sourceCode }) => {
        secretLintProfiler.mark({
          type: "@core>rule-handler::start",
          id: descriptorRule.rule.meta.id
        });
        if (rule.supportSourceCode(sourceCode)) {
          await rule.file(sourceCode);
        }
        secretLintProfiler.mark({
          type: "@core>rule-handler::end",
          id: descriptorRule.rule.meta.id
        });
      });
    },
    registerRulePreset({ descriptorRulePreset, context }) {
      const rulePresetCreatorOptions = descriptorRulePreset.options || [];
      descriptorRulePreset.rule.create(context, rulePresetCreatorOptions);
    },
    isRegistered(ruleId) {
      return registerSet.has(ruleId);
    }
  };
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/RulePresetContext.js
var createRulePresetContext = ({ configRulePreset, sourceCode, runningEvents, contextEvents, sharedOptions, locale }) => {
  const presetRules = configRulePreset.rules || [];
  if (!Array.isArray(presetRules)) {
    console.error(`${configRulePreset.id}:PresetRules is invalid format`, presetRules);
    throw new Error("preset's rules should be an array of rule definitions");
  }
  return {
    sharedOptions,
    registerRule(rule, defaultValue) {
      const descriptorRule = presetRules.find((descriptorRule2) => {
        return descriptorRule2.id === rule.meta.id;
      });
      const descriptorRuleOptions = descriptorRule ? descriptorRule.options : void 0;
      const descriptorRuleDisabled = descriptorRule ? descriptorRule.disabled : void 0;
      const descriptorRuleSeverity = descriptorRule ? descriptorRule.severity : void 0;
      const descriptorAllowMessageIds = descriptorRule ? descriptorRule.allowMessageIds : void 0;
      const context = createRuleContext({
        // rule id is a single rule in a preset
        ruleId: rule.meta.id,
        // parent rule id is rule preset id
        ruleParentId: configRulePreset.id,
        meta: rule.meta,
        severity: descriptorRuleSeverity,
        sourceCode,
        contextEvents,
        sharedOptions,
        locale
      });
      const defaultValueOfPreset = defaultValue ? defaultValue : {};
      runningEvents.registerRule({
        descriptorRule: {
          // options and disabled ...
          ...defaultValueOfPreset,
          // Prefer to use user setting
          // User can override preset setting
          ...descriptorRule,
          id: rule.meta.id,
          options: descriptorRuleOptions,
          rule,
          disabled: descriptorRuleDisabled,
          allowMessageIds: descriptorAllowMessageIds,
          severity: descriptorRuleSeverity
        },
        context
      });
    }
  };
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/filter-ignored-process.js
var isContainedRange = (index, range) => {
  const [start, end] = range;
  return start <= index && index <= end;
};
function filterIgnoredMessages(options) {
  const reportedMessages = options.reportedMessages;
  const ignoreMessages = options.ignoredMessages;
  return reportedMessages.filter((message) => {
    return !ignoreMessages.some((ignoreMessage) => {
      const isInIgnoringRange = isContainedRange(message.range[0], ignoreMessage.range) && isContainedRange(message.range[1], ignoreMessage.range);
      if (isInIgnoringRange && ignoreMessage.targetRuleId) {
        if (ignoreMessage.targetRuleId === "*") {
          return true;
        }
        return message.ruleId === ignoreMessage.targetRuleId;
      }
      return isInIgnoringRange;
    });
  });
}

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/MessageProcessManager.js
var createMessageProcessor = (processors) => {
  return {
    /**
     * process `messages` with registered processes
     */
    process(messages2) {
      const originalMessages = messages2;
      if (processors.length === 0) {
        throw new Error("processors should be > 0");
      }
      return processors.reduce((messages3, filter) => {
        return filter(messages3);
      }, originalMessages);
    }
  };
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/filter-duplicated-process.js
var isEqualMessage = (aMessage, bMessage) => {
  return aMessage.range[0] === bMessage.range[0] && aMessage.range[1] === bMessage.range[1] && "severity" in aMessage && "severity" in bMessage && aMessage.severity === bMessage.severity && aMessage.message === bMessage.message;
};
function filterDuplicatedMessages(messages2 = []) {
  return messages2.filter((message, index) => {
    const restMessages = messages2.slice(index + 1);
    return !restMessages.some((restMessage) => {
      return isEqualMessage(message, restMessage);
    });
  });
}

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/sort-messages-process.js
function sortMessagesByLocation(messages2) {
  return messages2.sort(function(a, b) {
    const startIndexDiff = a.range[0] - b.range[0];
    if (startIndexDiff === 0) {
      return a.range[1] - b.range[1];
    } else {
      return startIndexDiff;
    }
  });
}

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/filter-message-id.js
var filterByAllowMessageIds = (messages2, allowMessageIds) => {
  const disabledSet = new Set(allowMessageIds.map((allowMessage) => {
    return `${allowMessage.ruleId}--${allowMessage.messageId}`;
  }));
  return messages2.filter((message) => {
    return !disabledSet.has(`${message.ruleId}--${message.messageId}`);
  });
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/filter-mask-secrets.js
var deepMask = (object, handler) => {
  for (const key of Object.keys(object)) {
    if (typeof object[key] === "object" && object[key] !== null) {
      object[key] = deepMask(object[key], handler);
    } else if (typeof object[key] === "string") {
      object[key] = handler(object[key]);
    }
  }
  return object;
};
var createMaskValue = (value) => {
  return "*".repeat(value.length);
};
var maskWithValues = (str, maskedValues) => {
  let result = str;
  for (const maskValue of maskedValues) {
    result = result.replaceAll(maskValue, "*".repeat(maskValue.length));
  }
  return result;
};
var filterMaskSecretsData = (messages2 = []) => {
  return messages2.map((message) => {
    if (message.type !== "message") {
      return message;
    }
    const maskedValues = [];
    const maskedData = message.data ? deepMask(message.data, (value) => {
      maskedValues.push(value);
      return createMaskValue(value);
    }) : void 0;
    if (!maskedData) {
      return message;
    }
    const maskedMessage = maskWithValues(message.message, maskedValues);
    return {
      ...message,
      message: maskedMessage,
      data: maskedData
    };
  });
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/messages/index.js
var cleanupMessages = (options) => {
  const reportedMessages = filterIgnoredMessages(options);
  const reportedMessagesWithoutAllowMessageIds = filterByAllowMessageIds(reportedMessages, options.allowMessageIds);
  const filters = options.maskSecrets ? [filterDuplicatedMessages, filterMaskSecretsData] : [filterDuplicatedMessages];
  const filterProcess = createMessageProcessor(filters);
  return sortMessagesByLocation(filterProcess.process(reportedMessagesWithoutAllowMessageIds));
};

// ../../node_modules/.pnpm/@secretlint+core@13.1.0_supports-color@7.2.0/node_modules/@secretlint/core/module/index.js
var import_debug = __toESM(require_src(), 1);
var debug = (0, import_debug.default)("@secretlint/core");
var lintSource = ({ source, options }) => {
  secretLintProfiler.mark({
    type: "@core>lint::start",
    id: source.filePath
  });
  debug(`source filePath: %O`, source.filePath);
  debug(`options: %O`, options);
  const rules2 = options.config.rules;
  const locale = options.locale ?? "en";
  const maskSecrets = options.maskSecrets ?? false;
  const contextEvents = createContextEvents();
  const runningEvents = createRunningEvents();
  const reportedMessages = [];
  const ignoredMessages = [];
  contextEvents.onReport((message) => {
    reportedMessages.push(message);
  });
  contextEvents.onIgnore((message) => {
    ignoredMessages.push(message);
  });
  const sourceCode = new SecretLintSourceCodeImpl({
    content: source.content,
    filePath: source.filePath,
    physicalFilePath: options.noPhysicFilePath ? void 0 : source.filePath,
    ext: source.ext || "",
    contentType: source.contentType
  });
  secretLintProfiler.mark({
    type: "@core>setup-rules::start"
  });
  rules2.forEach((rule) => {
    secretLintProfiler.mark({
      type: "@core>setup-rule::start",
      id: rule.rule.meta.id
    });
    registerRule({
      sourceCode,
      config: options.config,
      descriptorRule: rule,
      contextEvents,
      runningEvents,
      locale
    });
    secretLintProfiler.mark({
      type: "@core>setup-rule::end",
      id: rule.rule.meta.id
    });
  });
  secretLintProfiler.mark({
    type: "@core>setup-rules::end"
  });
  return runningEvents.runLint({
    sourceCode
  }).then(() => {
    return {
      filePath: source.filePath,
      // binary content should be skipped
      sourceContent: source.contentType === "text" ? source.content : void 0,
      sourceContentType: source.contentType,
      messages: cleanupMessages({
        reportedMessages,
        ignoredMessages,
        allowMessageIds: runningEvents.collectAllowMessageIds(),
        maskSecrets
      })
    };
  }).finally(() => {
    secretLintProfiler.mark({
      type: "@core>lint::end",
      id: source.filePath
    });
  });
};
var isRulePreset = (ruleDescriptor) => {
  return ruleDescriptor.rule.meta.type === "preset";
};
var isRule = (ruleDescriptor) => {
  return ruleDescriptor.rule.meta.type === "scanner";
};
var registerRule = ({ sourceCode, config, descriptorRule, contextEvents, runningEvents, locale }) => {
  const ruleId = descriptorRule.id;
  if (descriptorRule.disabled) {
    debug("Skip registerRule %s, because it is disabled", ruleId);
    return;
  }
  debug("registerRule %s", ruleId);
  const sharedOptionsWithDefault = config.sharedOptions ?? {};
  if (isRulePreset(descriptorRule)) {
    const context = createRulePresetContext({
      configRulePreset: descriptorRule,
      sourceCode,
      contextEvents,
      runningEvents,
      sharedOptions: sharedOptionsWithDefault,
      locale
    });
    runningEvents.registerRulePreset({
      descriptorRulePreset: descriptorRule,
      context
    });
    return;
  } else if (isRule(descriptorRule)) {
    const context = createRuleContext({
      ruleId,
      severity: descriptorRule.severity,
      meta: descriptorRule.rule.meta,
      sourceCode,
      contextEvents,
      sharedOptions: sharedOptionsWithDefault,
      locale
    });
    runningEvents.registerRule({
      descriptorRule,
      context
    });
    return;
  }
  throw new Error(`Unknown descriptor type: ${descriptorRule}`);
};

// ../../node_modules/.pnpm/@secretlint+secretlint-rule-preset-recommend@13.1.0/node_modules/@secretlint/secretlint-rule-preset-recommend/module/index.js
import path from "node:path";
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
var regexpStringMatcher = {};
var lodash_uniq;
var hasRequiredLodash_uniq;
function requireLodash_uniq() {
  if (hasRequiredLodash_uniq) return lodash_uniq;
  hasRequiredLodash_uniq = 1;
  var LARGE_ARRAY_SIZE = 200;
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  var INFINITY = 1 / 0;
  var funcTag = "[object Function]", genTag = "[object GeneratorFunction]";
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal || freeSelf || Function("return this")();
  function arrayIncludes(array, value) {
    var length = array ? array.length : 0;
    return !!length && baseIndexOf(array, value, 0) > -1;
  }
  function baseFindIndex(array, predicate, fromIndex, fromRight) {
    var length = array.length, index = fromIndex + -1;
    while (++index < length) {
      if (predicate(array[index], index, array)) {
        return index;
      }
    }
    return -1;
  }
  function baseIndexOf(array, value, fromIndex) {
    if (value !== value) {
      return baseFindIndex(array, baseIsNaN, fromIndex);
    }
    var index = fromIndex - 1, length = array.length;
    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }
  function baseIsNaN(value) {
    return value !== value;
  }
  function cacheHas(cache, key) {
    return cache.has(key);
  }
  function getValue(object, key) {
    return object == null ? void 0 : object[key];
  }
  function isHostObject(value) {
    var result = false;
    if (value != null && typeof value.toString != "function") {
      try {
        result = !!(value + "");
      } catch (e) {
      }
    }
    return result;
  }
  function setToArray(set) {
    var index = -1, result = Array(set.size);
    set.forEach(function(value) {
      result[++index] = value;
    });
    return result;
  }
  var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
  var coreJsData = root["__core-js_shared__"];
  var maskSrcKey = (function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
  })();
  var funcToString = funcProto.toString;
  var hasOwnProperty = objectProto.hasOwnProperty;
  var objectToString = objectProto.toString;
  var reIsNative = RegExp(
    "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  var splice = arrayProto.splice;
  var Map2 = getNative(root, "Map"), Set2 = getNative(root, "Set"), nativeCreate = getNative(Object, "create");
  function Hash(entries) {
    var index = -1, length = entries ? entries.length : 0;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function hashClear() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
  }
  function hashDelete(key) {
    return this.has(key) && delete this.__data__[key];
  }
  function hashGet(key) {
    var data = this.__data__;
    if (nativeCreate) {
      var result = data[key];
      return result === HASH_UNDEFINED ? void 0 : result;
    }
    return hasOwnProperty.call(data, key) ? data[key] : void 0;
  }
  function hashHas(key) {
    var data = this.__data__;
    return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
  }
  function hashSet(key, value) {
    var data = this.__data__;
    data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
    return this;
  }
  Hash.prototype.clear = hashClear;
  Hash.prototype["delete"] = hashDelete;
  Hash.prototype.get = hashGet;
  Hash.prototype.has = hashHas;
  Hash.prototype.set = hashSet;
  function ListCache(entries) {
    var index = -1, length = entries ? entries.length : 0;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function listCacheClear() {
    this.__data__ = [];
  }
  function listCacheDelete(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
      return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
      data.pop();
    } else {
      splice.call(data, index, 1);
    }
    return true;
  }
  function listCacheGet(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    return index < 0 ? void 0 : data[index][1];
  }
  function listCacheHas(key) {
    return assocIndexOf(this.__data__, key) > -1;
  }
  function listCacheSet(key, value) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }
  ListCache.prototype.clear = listCacheClear;
  ListCache.prototype["delete"] = listCacheDelete;
  ListCache.prototype.get = listCacheGet;
  ListCache.prototype.has = listCacheHas;
  ListCache.prototype.set = listCacheSet;
  function MapCache(entries) {
    var index = -1, length = entries ? entries.length : 0;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function mapCacheClear() {
    this.__data__ = {
      "hash": new Hash(),
      "map": new (Map2 || ListCache)(),
      "string": new Hash()
    };
  }
  function mapCacheDelete(key) {
    return getMapData(this, key)["delete"](key);
  }
  function mapCacheGet(key) {
    return getMapData(this, key).get(key);
  }
  function mapCacheHas(key) {
    return getMapData(this, key).has(key);
  }
  function mapCacheSet(key, value) {
    getMapData(this, key).set(key, value);
    return this;
  }
  MapCache.prototype.clear = mapCacheClear;
  MapCache.prototype["delete"] = mapCacheDelete;
  MapCache.prototype.get = mapCacheGet;
  MapCache.prototype.has = mapCacheHas;
  MapCache.prototype.set = mapCacheSet;
  function SetCache(values) {
    var index = -1, length = values ? values.length : 0;
    this.__data__ = new MapCache();
    while (++index < length) {
      this.add(values[index]);
    }
  }
  function setCacheAdd(value) {
    this.__data__.set(value, HASH_UNDEFINED);
    return this;
  }
  function setCacheHas(value) {
    return this.__data__.has(value);
  }
  SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
  SetCache.prototype.has = setCacheHas;
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }
  function baseIsNative(value) {
    if (!isObject(value) || isMasked(value)) {
      return false;
    }
    var pattern = isFunction(value) || isHostObject(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource(value));
  }
  function baseUniq(array, iteratee, comparator) {
    var index = -1, includes = arrayIncludes, length = array.length, isCommon = true, result = [], seen = result;
    if (length >= LARGE_ARRAY_SIZE) {
      var set = createSet(array);
      if (set) {
        return setToArray(set);
      }
      isCommon = false;
      includes = cacheHas;
      seen = new SetCache();
    } else {
      seen = result;
    }
    outer:
      while (++index < length) {
        var value = array[index], computed = value;
        value = value !== 0 ? value : 0;
        if (isCommon && computed === computed) {
          var seenIndex = seen.length;
          while (seenIndex--) {
            if (seen[seenIndex] === computed) {
              continue outer;
            }
          }
          result.push(value);
        } else if (!includes(seen, computed, comparator)) {
          if (seen !== result) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
    return result;
  }
  var createSet = !(Set2 && 1 / setToArray(new Set2([, -0]))[1] == INFINITY) ? noop : function(values) {
    return new Set2(values);
  };
  function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
  }
  function getNative(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : void 0;
  }
  function isKeyable(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
  }
  function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
  }
  function toSource(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {
      }
      try {
        return func + "";
      } catch (e) {
      }
    }
    return "";
  }
  function uniq(array) {
    return array && array.length ? baseUniq(array) : [];
  }
  function eq(value, other) {
    return value === other || value !== value && other !== other;
  }
  function isFunction(value) {
    var tag = isObject(value) ? objectToString.call(value) : "";
    return tag == funcTag || tag == genTag;
  }
  function isObject(value) {
    var type = typeof value;
    return !!value && (type == "object" || type == "function");
  }
  function noop() {
  }
  lodash_uniq = uniq;
  return lodash_uniq;
}
var lodash_uniqwith;
var hasRequiredLodash_uniqwith;
function requireLodash_uniqwith() {
  if (hasRequiredLodash_uniqwith) return lodash_uniqwith;
  hasRequiredLodash_uniqwith = 1;
  var LARGE_ARRAY_SIZE = 200;
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  var INFINITY = 1 / 0;
  var funcTag = "[object Function]", genTag = "[object GeneratorFunction]";
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal || freeSelf || Function("return this")();
  function arrayIncludes(array, value) {
    var length = array ? array.length : 0;
    return !!length && baseIndexOf(array, value, 0) > -1;
  }
  function arrayIncludesWith(array, value, comparator) {
    var index = -1, length = array ? array.length : 0;
    while (++index < length) {
      if (comparator(value, array[index])) {
        return true;
      }
    }
    return false;
  }
  function baseFindIndex(array, predicate, fromIndex, fromRight) {
    var length = array.length, index = fromIndex + -1;
    while (++index < length) {
      if (predicate(array[index], index, array)) {
        return index;
      }
    }
    return -1;
  }
  function baseIndexOf(array, value, fromIndex) {
    if (value !== value) {
      return baseFindIndex(array, baseIsNaN, fromIndex);
    }
    var index = fromIndex - 1, length = array.length;
    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }
  function baseIsNaN(value) {
    return value !== value;
  }
  function cacheHas(cache, key) {
    return cache.has(key);
  }
  function getValue(object, key) {
    return object == null ? void 0 : object[key];
  }
  function isHostObject(value) {
    var result = false;
    if (value != null && typeof value.toString != "function") {
      try {
        result = !!(value + "");
      } catch (e) {
      }
    }
    return result;
  }
  function setToArray(set) {
    var index = -1, result = Array(set.size);
    set.forEach(function(value) {
      result[++index] = value;
    });
    return result;
  }
  var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
  var coreJsData = root["__core-js_shared__"];
  var maskSrcKey = (function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
  })();
  var funcToString = funcProto.toString;
  var hasOwnProperty = objectProto.hasOwnProperty;
  var objectToString = objectProto.toString;
  var reIsNative = RegExp(
    "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  var splice = arrayProto.splice;
  var Map2 = getNative(root, "Map"), Set2 = getNative(root, "Set"), nativeCreate = getNative(Object, "create");
  function Hash(entries) {
    var index = -1, length = entries ? entries.length : 0;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function hashClear() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
  }
  function hashDelete(key) {
    return this.has(key) && delete this.__data__[key];
  }
  function hashGet(key) {
    var data = this.__data__;
    if (nativeCreate) {
      var result = data[key];
      return result === HASH_UNDEFINED ? void 0 : result;
    }
    return hasOwnProperty.call(data, key) ? data[key] : void 0;
  }
  function hashHas(key) {
    var data = this.__data__;
    return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
  }
  function hashSet(key, value) {
    var data = this.__data__;
    data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
    return this;
  }
  Hash.prototype.clear = hashClear;
  Hash.prototype["delete"] = hashDelete;
  Hash.prototype.get = hashGet;
  Hash.prototype.has = hashHas;
  Hash.prototype.set = hashSet;
  function ListCache(entries) {
    var index = -1, length = entries ? entries.length : 0;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function listCacheClear() {
    this.__data__ = [];
  }
  function listCacheDelete(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
      return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
      data.pop();
    } else {
      splice.call(data, index, 1);
    }
    return true;
  }
  function listCacheGet(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    return index < 0 ? void 0 : data[index][1];
  }
  function listCacheHas(key) {
    return assocIndexOf(this.__data__, key) > -1;
  }
  function listCacheSet(key, value) {
    var data = this.__data__, index = assocIndexOf(data, key);
    if (index < 0) {
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }
  ListCache.prototype.clear = listCacheClear;
  ListCache.prototype["delete"] = listCacheDelete;
  ListCache.prototype.get = listCacheGet;
  ListCache.prototype.has = listCacheHas;
  ListCache.prototype.set = listCacheSet;
  function MapCache(entries) {
    var index = -1, length = entries ? entries.length : 0;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  function mapCacheClear() {
    this.__data__ = {
      "hash": new Hash(),
      "map": new (Map2 || ListCache)(),
      "string": new Hash()
    };
  }
  function mapCacheDelete(key) {
    return getMapData(this, key)["delete"](key);
  }
  function mapCacheGet(key) {
    return getMapData(this, key).get(key);
  }
  function mapCacheHas(key) {
    return getMapData(this, key).has(key);
  }
  function mapCacheSet(key, value) {
    getMapData(this, key).set(key, value);
    return this;
  }
  MapCache.prototype.clear = mapCacheClear;
  MapCache.prototype["delete"] = mapCacheDelete;
  MapCache.prototype.get = mapCacheGet;
  MapCache.prototype.has = mapCacheHas;
  MapCache.prototype.set = mapCacheSet;
  function SetCache(values) {
    var index = -1, length = values ? values.length : 0;
    this.__data__ = new MapCache();
    while (++index < length) {
      this.add(values[index]);
    }
  }
  function setCacheAdd(value) {
    this.__data__.set(value, HASH_UNDEFINED);
    return this;
  }
  function setCacheHas(value) {
    return this.__data__.has(value);
  }
  SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
  SetCache.prototype.has = setCacheHas;
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }
  function baseIsNative(value) {
    if (!isObject(value) || isMasked(value)) {
      return false;
    }
    var pattern = isFunction(value) || isHostObject(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource(value));
  }
  function baseUniq(array, iteratee, comparator) {
    var index = -1, includes = arrayIncludes, length = array.length, isCommon = true, result = [], seen = result;
    if (comparator) {
      isCommon = false;
      includes = arrayIncludesWith;
    } else if (length >= LARGE_ARRAY_SIZE) {
      var set = createSet(array);
      if (set) {
        return setToArray(set);
      }
      isCommon = false;
      includes = cacheHas;
      seen = new SetCache();
    } else {
      seen = result;
    }
    outer:
      while (++index < length) {
        var value = array[index], computed = value;
        value = comparator || value !== 0 ? value : 0;
        if (isCommon && computed === computed) {
          var seenIndex = seen.length;
          while (seenIndex--) {
            if (seen[seenIndex] === computed) {
              continue outer;
            }
          }
          result.push(value);
        } else if (!includes(seen, computed, comparator)) {
          if (seen !== result) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
    return result;
  }
  var createSet = !(Set2 && 1 / setToArray(new Set2([, -0]))[1] == INFINITY) ? noop : function(values) {
    return new Set2(values);
  };
  function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
  }
  function getNative(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : void 0;
  }
  function isKeyable(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
  }
  function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
  }
  function toSource(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {
      }
      try {
        return func + "";
      } catch (e) {
      }
    }
    return "";
  }
  function uniqWith(array, comparator) {
    return array && array.length ? baseUniq(array, void 0, comparator) : [];
  }
  function eq(value, other) {
    return value === other || value !== value && other !== other;
  }
  function isFunction(value) {
    var tag = isObject(value) ? objectToString.call(value) : "";
    return tag == funcTag || tag == genTag;
  }
  function isObject(value) {
    var type = typeof value;
    return !!value && (type == "object" || type == "function");
  }
  function noop() {
  }
  lodash_uniqwith = uniqWith;
  return lodash_uniqwith;
}
var lodash_sortby = { exports: {} };
lodash_sortby.exports;
var hasRequiredLodash_sortby;
function requireLodash_sortby() {
  if (hasRequiredLodash_sortby) return lodash_sortby.exports;
  hasRequiredLodash_sortby = 1;
  (function(module, exports) {
    var LARGE_ARRAY_SIZE = 200;
    var FUNC_ERROR_TEXT = "Expected a function";
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    var UNORDERED_COMPARE_FLAG = 1, PARTIAL_COMPARE_FLAG = 2;
    var MAX_SAFE_INTEGER = 9007199254740991;
    var argsTag = "[object Arguments]", arrayTag = "[object Array]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", objectTag = "[object Object]", promiseTag = "[object Promise]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", weakMapTag = "[object WeakMap]";
    var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
    var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/, reLeadingDot = /^\./, rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
    var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
    var reEscapeChar = /\\(\\)?/g;
    var reIsHostCtor = /^\[object .+?Constructor\]$/;
    var reIsUint = /^(?:0|[1-9]\d*)$/;
    var typedArrayTags = {};
    typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
    typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
    var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    var freeExports = exports && !exports.nodeType && exports;
    var freeModule = freeExports && true && module && !module.nodeType && module;
    var moduleExports = freeModule && freeModule.exports === freeExports;
    var freeProcess = moduleExports && freeGlobal.process;
    var nodeUtil = (function() {
      try {
        return freeProcess && freeProcess.binding("util");
      } catch (e) {
      }
    })();
    var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
    function apply(func, thisArg, args) {
      switch (args.length) {
        case 0:
          return func.call(thisArg);
        case 1:
          return func.call(thisArg, args[0]);
        case 2:
          return func.call(thisArg, args[0], args[1]);
        case 3:
          return func.call(thisArg, args[0], args[1], args[2]);
      }
      return func.apply(thisArg, args);
    }
    function arrayMap(array, iteratee) {
      var index = -1, length = array ? array.length : 0, result = Array(length);
      while (++index < length) {
        result[index] = iteratee(array[index], index, array);
      }
      return result;
    }
    function arrayPush(array, values) {
      var index = -1, length = values.length, offset = array.length;
      while (++index < length) {
        array[offset + index] = values[index];
      }
      return array;
    }
    function arraySome(array, predicate) {
      var index = -1, length = array ? array.length : 0;
      while (++index < length) {
        if (predicate(array[index], index, array)) {
          return true;
        }
      }
      return false;
    }
    function baseProperty(key) {
      return function(object) {
        return object == null ? void 0 : object[key];
      };
    }
    function baseSortBy(array, comparer) {
      var length = array.length;
      array.sort(comparer);
      while (length--) {
        array[length] = array[length].value;
      }
      return array;
    }
    function baseTimes(n, iteratee) {
      var index = -1, result = Array(n);
      while (++index < n) {
        result[index] = iteratee(index);
      }
      return result;
    }
    function baseUnary(func) {
      return function(value) {
        return func(value);
      };
    }
    function getValue(object, key) {
      return object == null ? void 0 : object[key];
    }
    function isHostObject(value) {
      var result = false;
      if (value != null && typeof value.toString != "function") {
        try {
          result = !!(value + "");
        } catch (e) {
        }
      }
      return result;
    }
    function mapToArray(map) {
      var index = -1, result = Array(map.size);
      map.forEach(function(value, key) {
        result[++index] = [key, value];
      });
      return result;
    }
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    function setToArray(set) {
      var index = -1, result = Array(set.size);
      set.forEach(function(value) {
        result[++index] = value;
      });
      return result;
    }
    var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
    var coreJsData = root["__core-js_shared__"];
    var maskSrcKey = (function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    })();
    var funcToString = funcProto.toString;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var objectToString = objectProto.toString;
    var reIsNative = RegExp(
      "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    );
    var Symbol2 = root.Symbol, Uint8Array2 = root.Uint8Array, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, spreadableSymbol = Symbol2 ? Symbol2.isConcatSpreadable : void 0;
    var nativeKeys = overArg(Object.keys, Object), nativeMax = Math.max;
    var DataView = getNative(root, "DataView"), Map2 = getNative(root, "Map"), Promise2 = getNative(root, "Promise"), Set2 = getNative(root, "Set"), WeakMap = getNative(root, "WeakMap"), nativeCreate = getNative(Object, "create");
    var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map2), promiseCtorString = toSource(Promise2), setCtorString = toSource(Set2), weakMapCtorString = toSource(WeakMap);
    var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
    function Hash(entries) {
      var index = -1, length = entries ? entries.length : 0;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
    }
    function hashDelete(key) {
      return this.has(key) && delete this.__data__[key];
    }
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? void 0 : result;
      }
      return hasOwnProperty.call(data, key) ? data[key] : void 0;
    }
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
    }
    function hashSet(key, value) {
      var data = this.__data__;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    Hash.prototype.clear = hashClear;
    Hash.prototype["delete"] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;
    function ListCache(entries) {
      var index = -1, length = entries ? entries.length : 0;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function listCacheClear() {
      this.__data__ = [];
    }
    function listCacheDelete(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index, 1);
      }
      return true;
    }
    function listCacheGet(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      return index < 0 ? void 0 : data[index][1];
    }
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    function listCacheSet(key, value) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        data.push([key, value]);
      } else {
        data[index][1] = value;
      }
      return this;
    }
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype["delete"] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;
    function MapCache(entries) {
      var index = -1, length = entries ? entries.length : 0;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function mapCacheClear() {
      this.__data__ = {
        "hash": new Hash(),
        "map": new (Map2 || ListCache)(),
        "string": new Hash()
      };
    }
    function mapCacheDelete(key) {
      return getMapData(this, key)["delete"](key);
    }
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    function mapCacheSet(key, value) {
      getMapData(this, key).set(key, value);
      return this;
    }
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype["delete"] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;
    function SetCache(values) {
      var index = -1, length = values ? values.length : 0;
      this.__data__ = new MapCache();
      while (++index < length) {
        this.add(values[index]);
      }
    }
    function setCacheAdd(value) {
      this.__data__.set(value, HASH_UNDEFINED);
      return this;
    }
    function setCacheHas(value) {
      return this.__data__.has(value);
    }
    SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
    SetCache.prototype.has = setCacheHas;
    function Stack(entries) {
      this.__data__ = new ListCache(entries);
    }
    function stackClear() {
      this.__data__ = new ListCache();
    }
    function stackDelete(key) {
      return this.__data__["delete"](key);
    }
    function stackGet(key) {
      return this.__data__.get(key);
    }
    function stackHas(key) {
      return this.__data__.has(key);
    }
    function stackSet(key, value) {
      var cache = this.__data__;
      if (cache instanceof ListCache) {
        var pairs = cache.__data__;
        if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
          pairs.push([key, value]);
          return this;
        }
        cache = this.__data__ = new MapCache(pairs);
      }
      cache.set(key, value);
      return this;
    }
    Stack.prototype.clear = stackClear;
    Stack.prototype["delete"] = stackDelete;
    Stack.prototype.get = stackGet;
    Stack.prototype.has = stackHas;
    Stack.prototype.set = stackSet;
    function arrayLikeKeys(value, inherited) {
      var result = isArray(value) || isArguments(value) ? baseTimes(value.length, String) : [];
      var length = result.length, skipIndexes = !!length;
      for (var key in value) {
        if (hasOwnProperty.call(value, key) && !(skipIndexes && (key == "length" || isIndex(key, length)))) {
          result.push(key);
        }
      }
      return result;
    }
    function assocIndexOf(array, key) {
      var length = array.length;
      while (length--) {
        if (eq(array[length][0], key)) {
          return length;
        }
      }
      return -1;
    }
    var baseEach = createBaseEach(baseForOwn);
    function baseFlatten(array, depth, predicate, isStrict, result) {
      var index = -1, length = array.length;
      predicate || (predicate = isFlattenable);
      result || (result = []);
      while (++index < length) {
        var value = array[index];
        if (predicate(value)) {
          {
            arrayPush(result, value);
          }
        } else {
          result[result.length] = value;
        }
      }
      return result;
    }
    var baseFor = createBaseFor();
    function baseForOwn(object, iteratee) {
      return object && baseFor(object, iteratee, keys);
    }
    function baseGet(object, path2) {
      path2 = isKey(path2, object) ? [path2] : castPath(path2);
      var index = 0, length = path2.length;
      while (object != null && index < length) {
        object = object[toKey(path2[index++])];
      }
      return index && index == length ? object : void 0;
    }
    function baseGetTag(value) {
      return objectToString.call(value);
    }
    function baseHasIn(object, key) {
      return object != null && key in Object(object);
    }
    function baseIsEqual(value, other, customizer, bitmask, stack) {
      if (value === other) {
        return true;
      }
      if (value == null || other == null || !isObject(value) && !isObjectLike(other)) {
        return value !== value && other !== other;
      }
      return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
    }
    function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
      var objIsArr = isArray(object), othIsArr = isArray(other), objTag = arrayTag, othTag = arrayTag;
      if (!objIsArr) {
        objTag = getTag(object);
        objTag = objTag == argsTag ? objectTag : objTag;
      }
      if (!othIsArr) {
        othTag = getTag(other);
        othTag = othTag == argsTag ? objectTag : othTag;
      }
      var objIsObj = objTag == objectTag && !isHostObject(object), othIsObj = othTag == objectTag && !isHostObject(other), isSameTag = objTag == othTag;
      if (isSameTag && !objIsObj) {
        stack || (stack = new Stack());
        return objIsArr || isTypedArray(object) ? equalArrays(object, other, equalFunc, customizer, bitmask, stack) : equalByTag(object, other, objTag, equalFunc, customizer, bitmask, stack);
      }
      if (!(bitmask & PARTIAL_COMPARE_FLAG)) {
        var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
        if (objIsWrapped || othIsWrapped) {
          var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
          stack || (stack = new Stack());
          return equalFunc(objUnwrapped, othUnwrapped, customizer, bitmask, stack);
        }
      }
      if (!isSameTag) {
        return false;
      }
      stack || (stack = new Stack());
      return equalObjects(object, other, equalFunc, customizer, bitmask, stack);
    }
    function baseIsMatch(object, source, matchData, customizer) {
      var index = matchData.length, length = index;
      if (object == null) {
        return !length;
      }
      object = Object(object);
      while (index--) {
        var data = matchData[index];
        if (data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) {
          return false;
        }
      }
      while (++index < length) {
        data = matchData[index];
        var key = data[0], objValue = object[key], srcValue = data[1];
        if (data[2]) {
          if (objValue === void 0 && !(key in object)) {
            return false;
          }
        } else {
          var stack = new Stack();
          var result;
          if (!(result === void 0 ? baseIsEqual(srcValue, objValue, customizer, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG, stack) : result)) {
            return false;
          }
        }
      }
      return true;
    }
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) || isHostObject(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }
    function baseIsTypedArray(value) {
      return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
    }
    function baseIteratee(value) {
      if (typeof value == "function") {
        return value;
      }
      if (value == null) {
        return identity;
      }
      if (typeof value == "object") {
        return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
      }
      return property(value);
    }
    function baseKeys(object) {
      if (!isPrototype(object)) {
        return nativeKeys(object);
      }
      var result = [];
      for (var key in Object(object)) {
        if (hasOwnProperty.call(object, key) && key != "constructor") {
          result.push(key);
        }
      }
      return result;
    }
    function baseMap(collection, iteratee) {
      var index = -1, result = isArrayLike(collection) ? Array(collection.length) : [];
      baseEach(collection, function(value, key, collection2) {
        result[++index] = iteratee(value, key, collection2);
      });
      return result;
    }
    function baseMatches(source) {
      var matchData = getMatchData(source);
      if (matchData.length == 1 && matchData[0][2]) {
        return matchesStrictComparable(matchData[0][0], matchData[0][1]);
      }
      return function(object) {
        return object === source || baseIsMatch(object, source, matchData);
      };
    }
    function baseMatchesProperty(path2, srcValue) {
      if (isKey(path2) && isStrictComparable(srcValue)) {
        return matchesStrictComparable(toKey(path2), srcValue);
      }
      return function(object) {
        var objValue = get(object, path2);
        return objValue === void 0 && objValue === srcValue ? hasIn(object, path2) : baseIsEqual(srcValue, objValue, void 0, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG);
      };
    }
    function baseOrderBy(collection, iteratees, orders) {
      var index = -1;
      iteratees = arrayMap(iteratees.length ? iteratees : [identity], baseUnary(baseIteratee));
      var result = baseMap(collection, function(value, key, collection2) {
        var criteria = arrayMap(iteratees, function(iteratee) {
          return iteratee(value);
        });
        return { "criteria": criteria, "index": ++index, "value": value };
      });
      return baseSortBy(result, function(object, other) {
        return compareMultiple(object, other, orders);
      });
    }
    function basePropertyDeep(path2) {
      return function(object) {
        return baseGet(object, path2);
      };
    }
    function baseRest(func, start) {
      start = nativeMax(start === void 0 ? func.length - 1 : start, 0);
      return function() {
        var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
        while (++index < length) {
          array[index] = args[start + index];
        }
        index = -1;
        var otherArgs = Array(start + 1);
        while (++index < start) {
          otherArgs[index] = args[index];
        }
        otherArgs[start] = array;
        return apply(func, this, otherArgs);
      };
    }
    function baseToString(value) {
      if (typeof value == "string") {
        return value;
      }
      if (isSymbol(value)) {
        return symbolToString ? symbolToString.call(value) : "";
      }
      var result = value + "";
      return result == "0" && 1 / value == -Infinity ? "-0" : result;
    }
    function castPath(value) {
      return isArray(value) ? value : stringToPath(value);
    }
    function compareAscending(value, other) {
      if (value !== other) {
        var valIsDefined = value !== void 0, valIsNull = value === null, valIsReflexive = value === value, valIsSymbol = isSymbol(value);
        var othIsDefined = other !== void 0, othIsNull = other === null, othIsReflexive = other === other, othIsSymbol = isSymbol(other);
        if (!othIsNull && !othIsSymbol && !valIsSymbol && value > other || valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol || valIsNull && othIsDefined && othIsReflexive || !valIsDefined && othIsReflexive || !valIsReflexive) {
          return 1;
        }
        if (!valIsNull && !valIsSymbol && !othIsSymbol && value < other || othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol || othIsNull && valIsDefined && valIsReflexive || !othIsDefined && valIsReflexive || !othIsReflexive) {
          return -1;
        }
      }
      return 0;
    }
    function compareMultiple(object, other, orders) {
      var index = -1, objCriteria = object.criteria, othCriteria = other.criteria, length = objCriteria.length, ordersLength = orders.length;
      while (++index < length) {
        var result = compareAscending(objCriteria[index], othCriteria[index]);
        if (result) {
          if (index >= ordersLength) {
            return result;
          }
          var order = orders[index];
          return result * (order == "desc" ? -1 : 1);
        }
      }
      return object.index - other.index;
    }
    function createBaseEach(eachFunc, fromRight) {
      return function(collection, iteratee) {
        if (collection == null) {
          return collection;
        }
        if (!isArrayLike(collection)) {
          return eachFunc(collection, iteratee);
        }
        var length = collection.length, index = -1, iterable = Object(collection);
        while (++index < length) {
          if (iteratee(iterable[index], index, iterable) === false) {
            break;
          }
        }
        return collection;
      };
    }
    function createBaseFor(fromRight) {
      return function(object, iteratee, keysFunc) {
        var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
        while (length--) {
          var key = props[++index];
          if (iteratee(iterable[key], key, iterable) === false) {
            break;
          }
        }
        return object;
      };
    }
    function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG, arrLength = array.length, othLength = other.length;
      if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
        return false;
      }
      var stacked = stack.get(array);
      if (stacked && stack.get(other)) {
        return stacked == other;
      }
      var index = -1, result = true, seen = bitmask & UNORDERED_COMPARE_FLAG ? new SetCache() : void 0;
      stack.set(array, other);
      stack.set(other, array);
      while (++index < arrLength) {
        var arrValue = array[index], othValue = other[index];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
        }
        if (compared !== void 0) {
          if (compared) {
            continue;
          }
          result = false;
          break;
        }
        if (seen) {
          if (!arraySome(other, function(othValue2, othIndex) {
            if (!seen.has(othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, customizer, bitmask, stack))) {
              return seen.add(othIndex);
            }
          })) {
            result = false;
            break;
          }
        } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
          result = false;
          break;
        }
      }
      stack["delete"](array);
      stack["delete"](other);
      return result;
    }
    function equalByTag(object, other, tag, equalFunc, customizer, bitmask, stack) {
      switch (tag) {
        case dataViewTag:
          if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
            return false;
          }
          object = object.buffer;
          other = other.buffer;
        case arrayBufferTag:
          if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
            return false;
          }
          return true;
        case boolTag:
        case dateTag:
        case numberTag:
          return eq(+object, +other);
        case errorTag:
          return object.name == other.name && object.message == other.message;
        case regexpTag:
        case stringTag:
          return object == other + "";
        case mapTag:
          var convert = mapToArray;
        case setTag:
          var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
          convert || (convert = setToArray);
          if (object.size != other.size && !isPartial) {
            return false;
          }
          var stacked = stack.get(object);
          if (stacked) {
            return stacked == other;
          }
          bitmask |= UNORDERED_COMPARE_FLAG;
          stack.set(object, other);
          var result = equalArrays(convert(object), convert(other), equalFunc, customizer, bitmask, stack);
          stack["delete"](object);
          return result;
        case symbolTag:
          if (symbolValueOf) {
            return symbolValueOf.call(object) == symbolValueOf.call(other);
          }
      }
      return false;
    }
    function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG, objProps = keys(object), objLength = objProps.length, othProps = keys(other), othLength = othProps.length;
      if (objLength != othLength && !isPartial) {
        return false;
      }
      var index = objLength;
      while (index--) {
        var key = objProps[index];
        if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
          return false;
        }
      }
      var stacked = stack.get(object);
      if (stacked && stack.get(other)) {
        return stacked == other;
      }
      var result = true;
      stack.set(object, other);
      stack.set(other, object);
      var skipCtor = isPartial;
      while (++index < objLength) {
        key = objProps[index];
        var objValue = object[key], othValue = other[key];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
        }
        if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack) : compared)) {
          result = false;
          break;
        }
        skipCtor || (skipCtor = key == "constructor");
      }
      if (result && !skipCtor) {
        var objCtor = object.constructor, othCtor = other.constructor;
        if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
          result = false;
        }
      }
      stack["delete"](object);
      stack["delete"](other);
      return result;
    }
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    function getMatchData(object) {
      var result = keys(object), length = result.length;
      while (length--) {
        var key = result[length], value = object[key];
        result[length] = [key, value, isStrictComparable(value)];
      }
      return result;
    }
    function getNative(object, key) {
      var value = getValue(object, key);
      return baseIsNative(value) ? value : void 0;
    }
    var getTag = baseGetTag;
    if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) {
      getTag = function(value) {
        var result = objectToString.call(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : void 0;
        if (ctorString) {
          switch (ctorString) {
            case dataViewCtorString:
              return dataViewTag;
            case mapCtorString:
              return mapTag;
            case promiseCtorString:
              return promiseTag;
            case setCtorString:
              return setTag;
            case weakMapCtorString:
              return weakMapTag;
          }
        }
        return result;
      };
    }
    function hasPath(object, path2, hasFunc) {
      path2 = isKey(path2, object) ? [path2] : castPath(path2);
      var result, index = -1, length = path2.length;
      while (++index < length) {
        var key = toKey(path2[index]);
        if (!(result = object != null && hasFunc(object, key))) {
          break;
        }
        object = object[key];
      }
      if (result) {
        return result;
      }
      var length = object ? object.length : 0;
      return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
    }
    function isFlattenable(value) {
      return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
    }
    function isIndex(value, length) {
      length = length == null ? MAX_SAFE_INTEGER : length;
      return !!length && (typeof value == "number" || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
    }
    function isIterateeCall(value, index, object) {
      if (!isObject(object)) {
        return false;
      }
      var type = typeof index;
      if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) {
        return eq(object[index], value);
      }
      return false;
    }
    function isKey(value, object) {
      if (isArray(value)) {
        return false;
      }
      var type = typeof value;
      if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
        return true;
      }
      return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
    }
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    function isPrototype(value) {
      var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
      return value === proto;
    }
    function isStrictComparable(value) {
      return value === value && !isObject(value);
    }
    function matchesStrictComparable(key, srcValue) {
      return function(object) {
        if (object == null) {
          return false;
        }
        return object[key] === srcValue && (srcValue !== void 0 || key in Object(object));
      };
    }
    var stringToPath = memoize(function(string) {
      string = toString(string);
      var result = [];
      if (reLeadingDot.test(string)) {
        result.push("");
      }
      string.replace(rePropName, function(match, number, quote, string2) {
        result.push(quote ? string2.replace(reEscapeChar, "$1") : number || match);
      });
      return result;
    });
    function toKey(value) {
      if (typeof value == "string" || isSymbol(value)) {
        return value;
      }
      var result = value + "";
      return result == "0" && 1 / value == -Infinity ? "-0" : result;
    }
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {
        }
        try {
          return func + "";
        } catch (e) {
        }
      }
      return "";
    }
    var sortBy = baseRest(function(collection, iteratees) {
      if (collection == null) {
        return [];
      }
      var length = iteratees.length;
      if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) {
        iteratees = [];
      } else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) {
        iteratees = [iteratees[0]];
      }
      return baseOrderBy(collection, baseFlatten(iteratees), []);
    });
    function memoize(func, resolver) {
      if (typeof func != "function" || resolver && typeof resolver != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      var memoized = function() {
        var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
        if (cache.has(key)) {
          return cache.get(key);
        }
        var result = func.apply(this, args);
        memoized.cache = cache.set(key, result);
        return result;
      };
      memoized.cache = new (memoize.Cache || MapCache)();
      return memoized;
    }
    memoize.Cache = MapCache;
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    function isArguments(value) {
      return isArrayLikeObject(value) && hasOwnProperty.call(value, "callee") && (!propertyIsEnumerable.call(value, "callee") || objectToString.call(value) == argsTag);
    }
    var isArray = Array.isArray;
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }
    function isArrayLikeObject(value) {
      return isObjectLike(value) && isArrayLike(value);
    }
    function isFunction(value) {
      var tag = isObject(value) ? objectToString.call(value) : "";
      return tag == funcTag || tag == genTag;
    }
    function isLength(value) {
      return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
    function toString(value) {
      return value == null ? "" : baseToString(value);
    }
    function get(object, path2, defaultValue) {
      var result = object == null ? void 0 : baseGet(object, path2);
      return result === void 0 ? defaultValue : result;
    }
    function hasIn(object, path2) {
      return object != null && hasPath(object, path2, baseHasIn);
    }
    function keys(object) {
      return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
    }
    function identity(value) {
      return value;
    }
    function property(path2) {
      return isKey(path2) ? baseProperty(toKey(path2)) : basePropertyDeep(path2);
    }
    module.exports = sortBy;
  })(lodash_sortby, lodash_sortby.exports);
  return lodash_sortby.exports;
}
var escapeStringRegexp;
var hasRequiredEscapeStringRegexp;
function requireEscapeStringRegexp() {
  if (hasRequiredEscapeStringRegexp) return escapeStringRegexp;
  hasRequiredEscapeStringRegexp = 1;
  escapeStringRegexp = (string) => {
    if (typeof string !== "string") {
      throw new TypeError("Expected a string");
    }
    return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
  };
  return escapeStringRegexp;
}
var regexpParse = {};
var hasRequiredRegexpParse;
function requireRegexpParse() {
  if (hasRequiredRegexpParse) return regexpParse;
  hasRequiredRegexpParse = 1;
  Object.defineProperty(regexpParse, "__esModule", { value: true });
  regexpParse.isRegExpString = regexpParse.parseRegExpString = void 0;
  var REGEXP_LITERAL_PATTERN = /^\/(.+)\/([guimysd]*)$/;
  var parseRegExpString = function(str) {
    var result = str.match(REGEXP_LITERAL_PATTERN);
    if (!result) {
      return null;
    }
    return {
      source: result[1],
      flagString: result[2]
    };
  };
  regexpParse.parseRegExpString = parseRegExpString;
  var isRegExpString = function(str) {
    return REGEXP_LITERAL_PATTERN.test(str);
  };
  regexpParse.isRegExpString = isRegExpString;
  return regexpParse;
}
var hasRequiredRegexpStringMatcher;
function requireRegexpStringMatcher() {
  if (hasRequiredRegexpStringMatcher) return regexpStringMatcher;
  hasRequiredRegexpStringMatcher = 1;
  (function(exports) {
    var __importDefault = regexpStringMatcher && regexpStringMatcher.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.matchPatterns = exports.createRegExp = void 0;
    var lodash_uniq_1 = __importDefault(requireLodash_uniq());
    var lodash_uniqwith_1 = __importDefault(requireLodash_uniqwith());
    var lodash_sortby_1 = __importDefault(requireLodash_sortby());
    var escape_string_regexp_1 = __importDefault(requireEscapeStringRegexp());
    var regexp_parse_1 = requireRegexpParse();
    var DEFAULT_FLAGS = "ug";
    var defaultFlags = function(flagsString) {
      if (flagsString.length === 0) {
        return DEFAULT_FLAGS;
      }
      return (0, lodash_uniq_1.default)((flagsString + DEFAULT_FLAGS).split("")).join("");
    };
    var createRegExp = function(patternString, defaultFlag) {
      if (defaultFlag === void 0) {
        defaultFlag = DEFAULT_FLAGS;
      }
      if (patternString.length === 0) {
        throw new Error("Empty string can not handled");
      }
      if ((0, regexp_parse_1.isRegExpString)(patternString)) {
        var regExpStructure = (0, regexp_parse_1.parseRegExpString)(patternString);
        if (regExpStructure) {
          return new RegExp(regExpStructure.source, defaultFlags(regExpStructure.flagString));
        }
        throw new Error('"'.concat(patternString, '" can not parse as RegExp.'));
      } else {
        return new RegExp((0, escape_string_regexp_1.default)(patternString), defaultFlag);
      }
    };
    exports.createRegExp = createRegExp;
    var isEqualMatchPatternResult = function(a, b) {
      return a.startIndex === b.startIndex && a.endIndex === b.endIndex && a.match === b.match;
    };
    var matchPatterns = function(text, regExpLikeStrings) {
      var matchPatternResults = [];
      regExpLikeStrings.map(function(patternString) {
        return (0, exports.createRegExp)(patternString);
      }).forEach(function(regExp) {
        var results = text.matchAll(regExp);
        Array.from(results).forEach(function(result) {
          if (result.index === void 0) {
            return;
          }
          var match = result[0];
          var index = result.index;
          matchPatternResults.push({
            match,
            captures: result.slice(1),
            startIndex: index,
            endIndex: index + match.length
          });
        });
      });
      var uniqResults = (0, lodash_uniqwith_1.default)(matchPatternResults, isEqualMatchPatternResult);
      return (0, lodash_sortby_1.default)(uniqResults, ["startIndex", "endIndex"]);
    };
    exports.matchPatterns = matchPatterns;
  })(regexpStringMatcher);
  return regexpStringMatcher;
}
var regexpStringMatcherExports = requireRegexpStringMatcher();
var BUILTIN_IGNORED = {
  AWSAccountID: ["AKIAIOSFODNN7EXAMPLE"],
  AWSSecretAccessKey: ["wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"]
};
var messages$r = {
  AWSAccountID: {
    en: (props) => `found AWS Account ID: ${props.ID}`,
    ja: (props) => `AWS Account ID: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  AWSSecretAccessKey: {
    en: (props) => `found AWS Secret Access Key: ${props.KEY}`,
    ja: (props) => `AWS Secret Access Key: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  AWSAccessKeyID: {
    en: (props) => `found AWS Access Key ID: ${props.ID}`,
    ja: (props) => `AWS Access Key Id: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var reportAWSAccessKey = ({ t, source, context, options }) => {
  const AWSAccessKeyIDPattern = /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g;
  const results = source.content.matchAll(AWSAccessKeyIDPattern);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    if (BUILTIN_IGNORED.AWSAccountID.includes(match)) {
      continue;
    }
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("AWSAccessKeyID", {
        ID: match
      }),
      range
    });
  }
};
var reportAWSSecretAccessKey = ({ t, source, context, options }) => {
  const AWS = "(?:AWS|aws|Aws)?_?";
  const QUOTE = `["']?`;
  const CONNECT = "\\s*(?::|=>|=)\\s*";
  const AWSSecretPatten = new RegExp(String.raw`${QUOTE}${AWS}(?:SECRET|secret|Secret)_?(?:ACCESS|access|Access)_?(?:KEY|key|Key)${QUOTE}${CONNECT}${QUOTE}([A-Za-z0-9/\+=]{40})${QUOTE}\b`, "g");
  const results = source.content.matchAll(AWSSecretPatten);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[1] || "";
    const range = [index, index + match.length];
    if (BUILTIN_IGNORED.AWSSecretAccessKey.includes(match)) {
      continue;
    }
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("AWSSecretAccessKey", {
        KEY: match
      }),
      range
    });
  }
};
var reportAWSAccountID = ({ t, source, context, options }) => {
  const AWS = "(AWS|aws|Aws)?_?";
  const QUOTE = `("|')?`;
  const CONNECT = "\\s*(:|=>|=)\\s*";
  const AWSSecretPatten = new RegExp(String.raw`${QUOTE}${AWS}(ACCOUNT|account|Account)_?(ID|id|Id)?${QUOTE}${CONNECT}${QUOTE}[0-9]{4}\-?[0-9]{4}\-?[0-9]{4}${QUOTE}\b`, "g");
  const results = source.content.matchAll(AWSSecretPatten);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("AWSAccountID", {
        ID: match
      }),
      range
    });
  }
};
var creator$s = {
  messages: messages$r,
  meta: {
    id: "@secretlint/secretlint-rule-aws",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-aws/README.md"
    }
  },
  create(context, options) {
    const normalizedOptions = {
      allows: options.allows || [],
      enableIDScanRule: options.enableIDScanRule ?? false
    };
    const t = context.createTranslator(messages$r);
    return {
      file(source) {
        if (normalizedOptions.enableIDScanRule) {
          reportAWSAccessKey({ t, source, context, options: normalizedOptions });
          reportAWSAccountID({ t, source, context, options: normalizedOptions });
        }
        reportAWSSecretAccessKey({ t, source, context, options: normalizedOptions });
      }
    };
  }
};
var TAG_INTEGER = 2;
var TAG_OCTET_STRING = 4;
var TAG_NULL = 5;
var TAG_OID = 6;
var TAG_SEQUENCE = 48;
var TAG_CONTEXT_0 = 160;
function readTlv(buf, offset) {
  if (offset + 2 > buf.length) {
    throw new Error("PKCS12: truncated TLV header");
  }
  const tag = buf[offset];
  const lenByte = buf[offset + 1];
  let length;
  let contentStart;
  if (lenByte < 128) {
    length = lenByte;
    contentStart = offset + 2;
  } else {
    const lenBytes = lenByte & 127;
    if (lenBytes === 0 || lenBytes > 4) {
      throw new Error("PKCS12: unsupported ASN.1 length encoding");
    }
    if (offset + 2 + lenBytes > buf.length) {
      throw new Error("PKCS12: truncated ASN.1 length");
    }
    length = 0;
    for (let i = 0; i < lenBytes; i++) {
      length = length * 256 + buf[offset + 2 + i];
    }
    contentStart = offset + 2 + lenBytes;
  }
  const end = contentStart + length;
  if (end > buf.length) {
    throw new Error("PKCS12: TLV extends past buffer");
  }
  return { tag, content: buf.subarray(contentStart, end), end };
}
function expectTag(tlv, tag, label) {
  if (tlv.tag !== tag) {
    throw new Error(`PKCS12: expected ${label} tag 0x${tag.toString(16)} but got 0x${tlv.tag.toString(16)}`);
  }
}
function readInteger(tlv) {
  expectTag(tlv, TAG_INTEGER, "INTEGER");
  let value = 0;
  for (const byte of tlv.content) {
    value = value * 256 + byte;
  }
  return value;
}
function bytesEqual(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
var OID_DATA = new Uint8Array([42, 134, 72, 134, 247, 13, 1, 7, 1]);
var OID_SHA1 = new Uint8Array([43, 14, 3, 2, 26]);
var OID_SHA256 = new Uint8Array([96, 134, 72, 1, 101, 3, 4, 2, 1]);
var OID_SHA384 = new Uint8Array([96, 134, 72, 1, 101, 3, 4, 2, 2]);
var OID_SHA512 = new Uint8Array([96, 134, 72, 1, 101, 3, 4, 2, 3]);
var MAC_HASHES = [
  { oid: OID_SHA1, hash: { name: "SHA-1", outputSize: 20, blockSize: 64 } },
  { oid: OID_SHA256, hash: { name: "SHA-256", outputSize: 32, blockSize: 64 } },
  { oid: OID_SHA384, hash: { name: "SHA-384", outputSize: 48, blockSize: 128 } },
  { oid: OID_SHA512, hash: { name: "SHA-512", outputSize: 64, blockSize: 128 } }
];
function matchHash(oidBytes) {
  for (const { oid, hash } of MAC_HASHES) {
    if (bytesEqual(oidBytes, oid))
      return hash;
  }
  return void 0;
}
var MAX_MAC_ITERATIONS = 1e5;
function parsePkcs12(buf) {
  const pfx = readTlv(buf, 0);
  expectTag(pfx, TAG_SEQUENCE, "PFX SEQUENCE");
  const version = readTlv(pfx.content, 0);
  if (readInteger(version) !== 3) {
    throw new Error("PKCS12: unsupported version");
  }
  const authSafeInfo = readTlv(pfx.content, version.end);
  expectTag(authSafeInfo, TAG_SEQUENCE, "ContentInfo SEQUENCE");
  const contentType = readTlv(authSafeInfo.content, 0);
  expectTag(contentType, TAG_OID, "contentType OID");
  if (!bytesEqual(contentType.content, OID_DATA)) {
    throw new Error("PKCS12: unsupported authSafe contentType");
  }
  const explicit0 = readTlv(authSafeInfo.content, contentType.end);
  expectTag(explicit0, TAG_CONTEXT_0, "[0] EXPLICIT");
  const authSafeOctet = readTlv(explicit0.content, 0);
  expectTag(authSafeOctet, TAG_OCTET_STRING, "authSafe OCTET STRING");
  const macData = readTlv(pfx.content, authSafeInfo.end);
  expectTag(macData, TAG_SEQUENCE, "MacData SEQUENCE");
  const digestInfo = readTlv(macData.content, 0);
  expectTag(digestInfo, TAG_SEQUENCE, "DigestInfo SEQUENCE");
  const alg = readTlv(digestInfo.content, 0);
  expectTag(alg, TAG_SEQUENCE, "AlgorithmIdentifier SEQUENCE");
  const algOid = readTlv(alg.content, 0);
  expectTag(algOid, TAG_OID, "algorithm OID");
  const macHash = matchHash(algOid.content);
  if (!macHash) {
    throw new Error("PKCS12: unsupported MAC digest algorithm");
  }
  if (algOid.end < alg.content.length) {
    const params = readTlv(alg.content, algOid.end);
    if (params.tag !== TAG_NULL) {
      throw new Error("PKCS12: unexpected MAC algorithm parameters");
    }
  }
  const digest = readTlv(digestInfo.content, alg.end);
  expectTag(digest, TAG_OCTET_STRING, "digest OCTET STRING");
  const salt = readTlv(macData.content, digestInfo.end);
  expectTag(salt, TAG_OCTET_STRING, "macSalt OCTET STRING");
  let iterations = 1;
  if (salt.end < macData.content.length) {
    const iter = readTlv(macData.content, salt.end);
    iterations = readInteger(iter);
  }
  if (iterations < 1 || iterations > MAX_MAC_ITERATIONS) {
    throw new Error("PKCS12: MAC iteration count out of range");
  }
  return {
    authSafe: authSafeOctet.content,
    macHash,
    macSalt: salt.content,
    macDigest: digest.content,
    iterations
  };
}
function toBufferSource(data) {
  const copy = new Uint8Array(data.length);
  copy.set(data);
  return copy;
}
var NODE_HASH_NAMES = {
  "SHA-1": "sha1",
  "SHA-256": "sha256",
  "SHA-384": "sha384",
  "SHA-512": "sha512"
};
async function createDigest(hash) {
  try {
    const { createHash: createHash2 } = await import("node:crypto");
    const algorithm = NODE_HASH_NAMES[hash.name];
    return (data) => new Uint8Array(createHash2(algorithm).update(data).digest());
  } catch {
    return async (data) => new Uint8Array(await globalThis.crypto.subtle.digest(hash.name, toBufferSource(data)));
  }
}
function padToMultipleOf(src, blockSize) {
  if (src.length === 0)
    return new Uint8Array(0);
  const padded = new Uint8Array(Math.ceil(src.length / blockSize) * blockSize);
  for (let i = 0; i < padded.length; i++) {
    padded[i] = src[i % src.length];
  }
  return padded;
}
function encodePasswordAsBmpString(password) {
  if (password.length === 0)
    return new Uint8Array(0);
  const bytes = new Uint8Array(password.length * 2 + 2);
  for (let i = 0; i < password.length; i++) {
    const code = password.charCodeAt(i);
    bytes[i * 2] = code >> 8 & 255;
    bytes[i * 2 + 1] = code & 255;
  }
  return bytes;
}
async function deriveMacKey(hash, password, salt, iterations) {
  const v = hash.blockSize;
  const u = hash.outputSize;
  const ID_MAC = 3;
  const D = new Uint8Array(v).fill(ID_MAC);
  const P = padToMultipleOf(encodePasswordAsBmpString(password), v);
  const S = padToMultipleOf(salt, v);
  const DI = new Uint8Array(D.length + S.length + P.length);
  DI.set(D, 0);
  DI.set(S, D.length);
  DI.set(P, D.length + S.length);
  const digest = await createDigest(hash);
  let A = await digest(DI);
  for (let i = 1; i < iterations; i++) {
    A = await digest(A);
  }
  return A.subarray(0, u);
}
async function verifyPkcs12Mac(pfxBytes, password) {
  let parsed;
  try {
    parsed = parsePkcs12(pfxBytes);
  } catch {
    return false;
  }
  try {
    const key = await deriveMacKey(parsed.macHash, password, parsed.macSalt, parsed.iterations);
    const cryptoKey = await globalThis.crypto.subtle.importKey("raw", toBufferSource(key), { name: "HMAC", hash: parsed.macHash.name }, false, ["sign"]);
    const mac = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", cryptoKey, toBufferSource(parsed.authSafe)));
    return bytesEqual(mac, parsed.macDigest);
  } catch {
    return false;
  }
}
var GCP_SERVICE_ACCOUNT_P12_PASSWORD = "notasecret";
async function reportIfFoundPrivateKeyP12Format({ source, options, context, t }) {
  if (!source.filePath) {
    return;
  }
  try {
    const fs = await import("node:fs");
    const path2 = await import("node:path");
    const fileName = path2.basename(source.filePath);
    if (regexpStringMatcherExports.matchPatterns(fileName, options.allows).length > 0) {
      return;
    }
    const pfxBytes = new Uint8Array(fs.readFileSync(source.filePath));
    const isGcpServiceAccountP12 = await verifyPkcs12Mac(pfxBytes, GCP_SERVICE_ACCOUNT_P12_PASSWORD);
    if (!isGcpServiceAccountP12) {
      return;
    }
    context.report({
      message: t("PrivateKeyP12", {
        FILE_NAME: fileName
      }),
      range: [0, source.content.length]
    });
  } catch {
  }
}
var messages$q = {
  PrivateKeyP12: {
    en: (props) => `found GCP Service Account's private key(p12): ${props.FILE_NAME}`,
    ja: (props) => `GCP\u30B5\u30FC\u30D3\u30B9\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u79D8\u5BC6\u9375(p12) ${props.FILE_NAME} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  PrivateKeyJSON: {
    en: (props) => `found GCP Service Account's private key(json): ${props.FILE_NAME}`,
    ja: (props) => `GCP\u30B5\u30FC\u30D3\u30B9\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u79D8\u5BC6\u9375(json): ${props.FILE_NAME} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
function reportIfFoundPrivateKeyJSONFormat({ source, options, context, t }) {
  try {
    const credentialObject = JSON.parse(source.content);
    const PRIVATE_KEY_PATTERN = /-----BEGIN\s?(DSA|RSA|EC|PGP|OPENSSH)?\s?PRIVATE KEY/gm;
    const isGCPServiceAccountPrivateKeyJSON = "private_key_id" in credentialObject && "private_key" in credentialObject && PRIVATE_KEY_PATTERN.test(credentialObject["private_key"]);
    if (!isGCPServiceAccountPrivateKeyJSON) {
      return;
    }
    const allowCandidates = [credentialObject["private_key_id"], credentialObject["private_key"]].filter((value) => typeof value === "string");
    if (allowCandidates.some((value) => regexpStringMatcherExports.matchPatterns(value, options.allows).length > 0)) {
      return;
    }
    context.report({
      message: t("PrivateKeyJSON", {
        FILE_NAME: source.filePath ? path.basename(source.filePath) : ""
      }),
      range: [0, source.content.length]
    });
  } catch {
  }
}
var creator$r = {
  messages: messages$q,
  meta: {
    id: "@secretlint/secretlint-rule-gcp",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["all"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-gcp/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$q);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        if (source.ext === ".p12") {
          return reportIfFoundPrivateKeyP12Format({ source, options: normalizedOptions, context, t });
        } else if (source.ext === ".json") {
          return reportIfFoundPrivateKeyJSONFormat({ source, options: normalizedOptions, context, t });
        }
      }
    };
  }
};
var messages$p = {
  PackageJSON_xOauthToken: {
    en: (props) => `found GitHub Token: ${props.TOKEN}`,
    ja: (props) => `GitHub Token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  Npmrc_authToken: {
    en: (props) => `found npmrc authToken: ${props.TOKEN}`,
    ja: (props) => `npmrc authToken: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  NPM_ACCESS_TOKEN: {
    en: (props) => `found npm access token: ${props.TOKEN}`,
    ja: (props) => `npm access token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
function reportIfFoundXOauthGitHubToken({ source, options, context, t }) {
  const XOAuthPattern = /https?:\/\/(.{1,256}):x-oauth-basic@github.com\//g;
  const results = source.content.matchAll(XOAuthPattern);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[1] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("PackageJSON_xOauthToken", {
        TOKEN: match
      }),
      range
    });
  }
}
function reportIfFound_AuthTokenInNpmrc({ source, options, context, t }) {
  const AuthTokenPattern = /_authToken=([^$].*)/g;
  const results = source.content.matchAll(AuthTokenPattern);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[1] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("Npmrc_authToken", {
        TOKEN: match
      }),
      range
    });
  }
}
function reportIfFound_NPM_ACCESS_TOKEN({ source, options, context, t }) {
  const NPM_ACCESS_TOKEN_PATTERN = new RegExp("(?<!\\p{L})npm_[A-Za-z0-9_]{36}(?![A-Za-z0-9_])", "gu");
  const results = source.content.matchAll(NPM_ACCESS_TOKEN_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("NPM_ACCESS_TOKEN", {
        TOKEN: match
      }),
      range
    });
  }
}
var isPackageFile = (filePath) => {
  if (!filePath) {
    return true;
  }
  return filePath.endsWith("package.json") || filePath.endsWith("package-lock.json");
};
var isNpmrc = (filePath) => {
  if (!filePath) {
    return true;
  }
  return filePath.endsWith(".npmrc");
};
var creator$q = {
  messages: messages$p,
  meta: {
    id: "@secretlint/secretlint-rule-npm",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-npm/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$p);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        if (isPackageFile(source.filePath)) {
          reportIfFoundXOauthGitHubToken({ source, options: normalizedOptions, context, t });
        } else if (isNpmrc(source.filePath)) {
          reportIfFound_AuthTokenInNpmrc({ source, options: normalizedOptions, context, t });
        }
        reportIfFound_NPM_ACCESS_TOKEN({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$o = {
  SLACK_TOKEN: {
    en: (props) => `found slack token: ${props.TOKEN}`,
    ja: (props) => `Slack\u30C8\u30FC\u30AF\u30F3: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  IncomingWebhook: {
    en: (props) => `found Slack Incoming Webhook: ${props.URL}`,
    ja: (props) => `Slack\u306EIncoming Webhooks: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
function reportIfFoundRawPrivateKey$1({ source, options, context, t }) {
  const SLACK_TOKEN_PATTERN = /\b(?:xoxb|xoxp|xapp|xoxa|xoxo|xoxr)-(?:\d-)?(?:[a-zA-Z0-9]{1,40}-)+[a-zA-Z0-9]{1,40}\b/g;
  const results = source.content.matchAll(SLACK_TOKEN_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("SLACK_TOKEN", {
        TOKEN: match
      }),
      range
    });
  }
}
function reportIfFoundIncomingWebhook({ source, options, context, t }) {
  const IncomingWebhooksPattern = /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9]{1,40}\/B[a-zA-Z0-9]{1,40}\/[a-zA-Z0-9]{1,40}/gi;
  const results = source.content.matchAll(IncomingWebhooksPattern);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("IncomingWebhook", {
        URL: match
      }),
      range
    });
  }
}
var creator$p = {
  messages: messages$o,
  meta: {
    id: "@secretlint/secretlint-rule-slack",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-slack/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$o);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        reportIfFoundRawPrivateKey$1({ source, options: normalizedOptions, context, t });
        reportIfFoundIncomingWebhook({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$n = {
  BasicAuth: {
    en: (props) => `found basic auth credential: ${props.CREDENTIAL}`,
    ja: (props) => `\u30D9\u30FC\u30B7\u30C3\u30AF\u8A8D\u8A3C\u60C5\u5831: ${props.CREDENTIAL} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var BUILTIN_IGNORED_PATTERNS$1 = [
  "localhost",
  "127.0.0.1",
  "password",
  "mypassword",
  "myusername",
  "{password}",
  "${password}",
  "{{password}}",
  "{username}",
  "${username}",
  "{{username}}",
  "YOUR_PASSWORD",
  "YOUR_USERNAME",
  "REPLACE_WITH_PASSWORD",
  "REPLACE_WITH_USERNAME"
];
function isVariableLikeString$1(str) {
  const variablePatterns = [
    /\$\{[^}]{1,50}\}/,
    // ${var}
    /\{\{[^}]{1,50}\}\}/,
    // {{var}}
    /\{[^}]{1,50}\}/,
    // {var}
    /%[A-Z_]{1,30}%/,
    // %VAR%
    /\$[A-Z_]{1,30}/
    // $VAR
  ];
  return variablePatterns.some((pattern) => pattern.test(str));
}
function isLikelyRealUsername(username) {
  if (username.length < 2)
    return false;
  if (isVariableLikeString$1(username))
    return false;
  if (BUILTIN_IGNORED_PATTERNS$1.some((pattern) => username.toLowerCase().includes(pattern.toLowerCase()))) {
    return false;
  }
  return true;
}
function isLikelyRealPassword(password) {
  if (password.length < 4)
    return false;
  if (isVariableLikeString$1(password))
    return false;
  if (BUILTIN_IGNORED_PATTERNS$1.some((pattern) => password.toLowerCase().includes(pattern.toLowerCase()))) {
    return false;
  }
  if (/^(.)\1{3,}$/.test(password))
    return false;
  return true;
}
function reportIfFoundBasicAuth({ source, options, context, t }) {
  const URL_PATTERN = /(?<protocol>(?:https?|ftp|ftps)):\/\/(?<user>[-a-zA-Z0-9_]{1,256}):(?<password>[-a-zA-Z0-9_]{1,256})@[-a-zA-Z0-9%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/g;
  const results = source.content.matchAll(URL_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const username = result.groups?.user;
    const password = result.groups?.password;
    if (!username || !password)
      continue;
    if (!isLikelyRealUsername(username))
      continue;
    if (!isLikelyRealPassword(password))
      continue;
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("BasicAuth", {
        CREDENTIAL: match
      }),
      range
    });
  }
}
var creator$o = {
  messages: messages$n,
  meta: {
    id: "@secretlint/secretlint-rule-basicauth",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-basicauth/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$n);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        reportIfFoundBasicAuth({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$m = {
  OPENAI_TOKEN: {
    en: (props) => `found OpenAI API token: ${props.TOKEN}`,
    ja: (props) => `OpenAI API \u30C8\u30FC\u30AF\u30F3: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$n = {
  messages: messages$m,
  meta: {
    id: "@secretlint/secretlint-rule-openai",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-openai/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$m);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = /sk-(?:proj|svcacct|admin)-(?:[A-Za-z0-9_-]{74}|[A-Za-z0-9_-]{58})T3BlbkFJ(?:[A-Za-z0-9_-]{74}|[A-Za-z0-9_-]{58})\b|sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/g;
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("OPENAI_TOKEN", {
              TOKEN: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$l = {
  ANTHROPIC_API_KEY: {
    en: (props) => `found Anthropic Claude API key: ${props.KEY}`,
    ja: (props) => `Anthropic Claude API \u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$m = {
  messages: messages$l,
  meta: {
    id: "@secretlint/secretlint-rule-anthropic",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-anthropic/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$l);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})sk-ant-api0\\d-[A-Za-z0-9_-]{90,128}AA(?![A-Za-z0-9_-])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("ANTHROPIC_API_KEY", {
              KEY: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$k = {
  GROQ_API_KEY: {
    en: (props) => `found Groq API key: ${props.KEY}`,
    ja: (props) => `Groq API \u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$l = {
  messages: messages$k,
  meta: {
    id: "@secretlint/secretlint-rule-groq",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-groq/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$k);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})gsk_[a-zA-Z0-9]{52}(?![a-zA-Z0-9])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("GROQ_API_KEY", {
              KEY: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$j = {
  HUGGINGFACE_USER_ACCESS_TOKEN: {
    en: (props) => `found Hugging Face User Access Token: ${props.TOKEN}`,
    ja: (props) => `Hugging Face User Access Token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$k = {
  messages: messages$j,
  meta: {
    id: "@secretlint/secretlint-rule-huggingface",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-huggingface/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$j);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})hf_[a-zA-Z]{34}(?![a-zA-Z])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("HUGGINGFACE_USER_ACCESS_TOKEN", {
              TOKEN: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$i = {
  LINEAR_API_TOKEN: {
    en: (props) => `found linear api token: ${props.ID}`,
    ja: (props) => `linear api token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$j = {
  messages: messages$i,
  meta: {
    id: "@secretlint/secretlint-rule-linear",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-linear/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$i);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})lin_api_[a-zA-Z0-9_]{32,128}(?![a-zA-Z0-9_])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("LINEAR_API_TOKEN", {
              ID: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$h = {
  NOTION_INTEGRATION_TOKEN: {
    en: (props) => `found Notion integration token: ${props.TOKEN}`,
    ja: (props) => `Notion integration \u30C8\u30FC\u30AF\u30F3: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
function reportIfFoundToken({ source, options, context, t }) {
  const NOTION_INTEGRATION_TOKEN_PATTERN = new RegExp("(?<!\\p{L})ntn_[0-9]{11}[A-Za-z0-9]{35}(?![A-Za-z0-9])", "gu");
  const results = source.content.matchAll(NOTION_INTEGRATION_TOKEN_PATTERN);
  for (const result of results) {
    const index = result.index ?? 0;
    const match = result[0] ?? "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("NOTION_INTEGRATION_TOKEN", {
        TOKEN: match
      }),
      range
    });
  }
}
var creator$i = {
  messages: messages$h,
  meta: {
    id: "@secretlint/secretlint-rule-notion",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-notion/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$h);
    const normalizedOptions = {
      allows: options.allows ?? []
    };
    return {
      file(source) {
        reportIfFoundToken({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$g = {
  PrivateKey: {
    en: (props) => `found private key: ${props.KEY}`,
    ja: (props) => `\u79D8\u5BC6\u9375: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var PEM_CONTENT_PATTERN = /-----BEGIN[ ]?(?:(?:RSA|DSA|EC|OPENSSH|PGP) )?PRIVATE KEY(?: BLOCK)?-----\n?([A-Za-z0-9+/=\s\\]{100,10000})\n?-----END[ ]?(?:(?:RSA|DSA|EC|OPENSSH|PGP) )?PRIVATE KEY(?: BLOCK)?-----/gm;
function validateBase64KeyContent(base64Content) {
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64Content)) {
    return false;
  }
  if (base64Content.length < 100) {
    return false;
  }
  const validMagicBytes = /^(MI|b3BlbnNzaC1rZXktdjE)/;
  if (!validMagicBytes.test(base64Content)) {
    return false;
  }
  return true;
}
function reportIfFoundRawPrivateKey({ source, options, context, t }) {
  const results = source.content.matchAll(PEM_CONTENT_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const base64Raw = result[1] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    const base64Content = base64Raw.replace(/\s|\\n/g, "");
    if (!validateBase64KeyContent(base64Content)) {
      continue;
    }
    context.report({
      message: t("PrivateKey", {
        KEY: match
      }),
      range
    });
  }
}
var creator$h = {
  messages: messages$g,
  meta: {
    id: "@secretlint/secretlint-rule-privatekey",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-privatekey/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$g);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        reportIfFoundRawPrivateKey({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$f = {
  SENDGRID_KEY: {
    en: (props) => `found Sendgrid api key: ${props.KEY}`,
    ja: (props) => `Sendgrid API\u30AD\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F\uFF1A ${props.KEY}`
  }
};
function reportIfFoundKey$3({ source, options, context, t }) {
  const SENDGRID_KEY_PATTERN = new RegExp("(?<!\\p{L})SG\\.\\w{1,128}\\.\\w{1,128}([-_]?)\\w{1,128}(?!\\w)", "gu");
  const results = source.content.matchAll(SENDGRID_KEY_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    if (match.length !== 69) {
      continue;
    }
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("SENDGRID_KEY", {
        KEY: match
      }),
      range
    });
  }
}
var creator$g = {
  messages: messages$f,
  meta: {
    id: "@secretlint/secretlint-rule-sendgrid",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-sendgrid/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$f);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        reportIfFoundKey$3({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$e = {
  SHOPIFY_KEY: {
    en: (props) => `found Shopify api key: ${props.KEY}`,
    ja: (props) => `Shopify API\u30AD\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F\uFF1A ${props.KEY}`
  }
};
function reportIfFoundKey$2({ source, options, context, t }) {
  const SHOPIFY_KEY_PATTERN = new RegExp("(?<!\\p{L})(shppa|shpca|shpat|shpss)_[a-zA-Z0-9]{32,64}(?![a-zA-Z0-9])", "gu");
  const results = source.content.matchAll(SHOPIFY_KEY_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("SHOPIFY_KEY", {
        KEY: match
      }),
      range
    });
  }
}
var creator$f = {
  messages: messages$e,
  meta: {
    id: "@secretlint/secretlint-rule-shopify",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-shopify/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$e);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        reportIfFoundKey$2({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$d = {
  STRIPE_SECRET_KEY_LIVE: {
    en: (props) => `found Stripe Live Secret Key: ${props.KEY}`,
    ja: (props) => `Stripe Live Secret Key\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.KEY}`
  },
  STRIPE_SECRET_KEY_TEST: {
    en: (props) => `found Stripe Test Secret Key: ${props.KEY}`,
    ja: (props) => `Stripe Test Secret Key\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.KEY}`
  },
  STRIPE_RESTRICTED_KEY_LIVE: {
    en: (props) => `found Stripe Live Restricted Key: ${props.KEY}`,
    ja: (props) => `Stripe Live Restricted Key\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.KEY}`
  },
  STRIPE_RESTRICTED_KEY_TEST: {
    en: (props) => `found Stripe Test Restricted Key: ${props.KEY}`,
    ja: (props) => `Stripe Test Restricted Key\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.KEY}`
  }
};
var messageIdMap$1 = {
  sk_live: "STRIPE_SECRET_KEY_LIVE",
  sk_test: "STRIPE_SECRET_KEY_TEST",
  rk_live: "STRIPE_RESTRICTED_KEY_LIVE",
  rk_test: "STRIPE_RESTRICTED_KEY_TEST"
};
var STRIPE_KEY_PATTERN = new RegExp("(?<!\\p{L})(?<prefix>sk_live|sk_test|rk_live|rk_test)_[a-zA-Z0-9]{24,99}(?![a-zA-Z0-9])", "gu");
function reportIfFound$2({ source, options, context, t }) {
  const results = source.content.matchAll(STRIPE_KEY_PATTERN);
  for (const result of results) {
    const index = result.index ?? 0;
    const match = result[0] ?? "";
    const prefix = result.groups?.["prefix"];
    if (!prefix) {
      continue;
    }
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t(messageIdMap$1[prefix], {
        KEY: match
      }),
      range
    });
  }
}
var creator$e = {
  messages: messages$d,
  meta: {
    id: "@secretlint/secretlint-rule-stripe",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-stripe/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$d);
    const normalizedOptions = {
      allows: options.allows ?? []
    };
    return {
      file(source) {
        reportIfFound$2({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$c = {
  GITHUB_TOKEN: {
    en: (props) => `found GitHub Token(${props.typeName}): ${props.KEY}`,
    ja: (props) => `GitHub Token(${props.typeName})\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F\uFF1A ${props.KEY}`
  }
};
var typeMap = /* @__PURE__ */ new Map([
  ["ghp", "GitHub personal access tokens"],
  ["gho", "OAuth access tokens"],
  ["ghu", "GitHub user-to-server tokens"],
  ["ghs", "GitHub server-to-server tokens"],
  ["ghr", "refresh tokens"],
  ["github_pat", "fine-grained personal access tokens"]
]);
function reportIfFoundKey$1({ pattern, source, options, context, t }) {
  const results = source.content.matchAll(pattern);
  for (const result of results) {
    const index = result.index || 0;
    const type = result.groups?.type;
    const typeName = typeMap.get(type);
    if (!typeName) {
      throw new Error("Unknown type:" + typeName);
    }
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("GITHUB_TOKEN", {
        KEY: match,
        typeName
      }),
      range
    });
  }
}
var creator$d = {
  messages: messages$c,
  meta: {
    id: "@secretlint/secretlint-rule-github",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-github/README.md"
    }
  },
  create(context, options) {
    const CLASSIC_GITHUB_TOKEN_PATTERN = new RegExp("(?<!\\p{L})(?<type>ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}(?![A-Za-z0-9_])", "gu");
    const FINE_GRAINED_GITHUB_TOKEN_PATTERN = new RegExp("(?<!\\p{L})(?<type>github_pat)_[A-Za-z0-9_]{82}(?![A-Za-z0-9_])", "gu");
    const GITHUB_APP_INSTALLATION_TOKEN_PATTERN = new RegExp("(?<!\\p{L})(?<type>ghs)_[0-9]{1,20}_[A-Za-z0-9_-]{1,1000}\\.[A-Za-z0-9_-]{1,10000}\\.[A-Za-z0-9_-]{1,1000}(?![A-Za-z0-9_-])", "gu");
    const patterns = [
      CLASSIC_GITHUB_TOKEN_PATTERN,
      FINE_GRAINED_GITHUB_TOKEN_PATTERN,
      GITHUB_APP_INSTALLATION_TOKEN_PATTERN
    ];
    const t = context.createTranslator(messages$c);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        for (const pattern of patterns) {
          reportIfFoundKey$1({ pattern, source, options: normalizedOptions, context, t });
        }
      }
    };
  }
};
var messages$b = {
  GITLAB_PERSONAL_ACCESS_TOKEN: {
    en: (props) => `found GitLab Personal Access Token: ${props.KEY}`,
    ja: (props) => `GitLab Personal Access Token\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.KEY}`
  }
};
function reportIfFoundKey({ pattern, source, options, context, t }) {
  const results = source.content.matchAll(pattern);
  for (const result of results) {
    const index = result.index ?? 0;
    const match = result[0] ?? "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("GITLAB_PERSONAL_ACCESS_TOKEN", {
        KEY: match
      }),
      range
    });
  }
}
var creator$c = {
  messages: messages$b,
  meta: {
    id: "@secretlint/secretlint-rule-gitlab",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-gitlab/README.md"
    }
  },
  create(context, options) {
    const GITLAB_PERSONAL_ACCESS_TOKEN_PATTERN = new RegExp("(?<!\\p{L})glpat-[A-Za-z0-9_-]{20,128}(?![A-Za-z0-9_-])", "gu");
    const patterns = [GITLAB_PERSONAL_ACCESS_TOKEN_PATTERN];
    const t = context.createTranslator(messages$b);
    const normalizedOptions = {
      allows: options.allows ?? []
    };
    return {
      file(source) {
        for (const pattern of patterns) {
          reportIfFoundKey({ pattern, source, options: normalizedOptions, context, t });
        }
      }
    };
  }
};
var messages$a = {
  GRAFANA_CLOUD_API_TOKEN: {
    en: (props) => `found Grafana Cloud API token: ${props.TOKEN}`,
    ja: (props) => `Grafana Cloud API \u30C8\u30FC\u30AF\u30F3: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  GRAFANA_SERVICE_ACCOUNT_TOKEN: {
    en: (props) => `found Grafana Service Account token: ${props.TOKEN}`,
    ja: (props) => `Grafana Service Account \u30C8\u30FC\u30AF\u30F3: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
function reportIfFound$1({ pattern, messageId, source, options, context, t }) {
  const results = source.content.matchAll(pattern);
  for (const result of results) {
    const index = result.index ?? 0;
    const match = result[0] ?? "";
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    const range = [index, index + match.length];
    context.report({
      message: t(messageId, {
        TOKEN: match
      }),
      range
    });
  }
}
var creator$b = {
  messages: messages$a,
  meta: {
    id: "@secretlint/secretlint-rule-grafana",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-grafana/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$a);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    const GRAFANA_CLOUD_API_TOKEN_PATTERN = new RegExp("(?<!\\p{L})glc_[A-Za-z0-9+/]{32,400}={0,2}(?![A-Za-z0-9+/=])", "gu");
    const GRAFANA_SERVICE_ACCOUNT_TOKEN_PATTERN = new RegExp("(?<!\\p{L})glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8}(?![A-Fa-f0-9])", "gu");
    return {
      file(source) {
        reportIfFound$1({
          pattern: GRAFANA_CLOUD_API_TOKEN_PATTERN,
          messageId: "GRAFANA_CLOUD_API_TOKEN",
          source,
          options: normalizedOptions,
          context,
          t
        });
        reportIfFound$1({
          pattern: GRAFANA_SERVICE_ACCOUNT_TOKEN_PATTERN,
          messageId: "GRAFANA_SERVICE_ACCOUNT_TOKEN",
          source,
          options: normalizedOptions,
          context,
          t
        });
      }
    };
  }
};
var messages$9 = {
  OPS_TOKEN: {
    en: (props) => `found 1Password Service Account token: ${props.TOKEN}`,
    ja: (props) => `1Password Service Account: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var is1PasswordServiceAccountToken = (base64String) => {
  try {
    const jsonString = atob(base64String.replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(jsonString);
    return typeof json === "object" && json !== null;
  } catch (error) {
    return false;
  }
};
var creator$a = {
  messages: messages$9,
  meta: {
    id: "@secretlint/secretlint-rule-1password",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-1password/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$9);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})ops_(ey[A-Za-z0-9+/=]{100,1280}fQ={0,2})(?![A-Za-z0-9+/=])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const base64String = match[1] ?? "";
          if (!is1PasswordServiceAccountToken(base64String)) {
            continue;
          }
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("OPS_TOKEN", {
              TOKEN: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$8 = {
  MongoDBConnection: {
    en: (props) => `found MongoDB connection string: ${props.URI}`,
    ja: (props) => `MongoDB\u63A5\u7D9A\u6587\u5B57\u5217: ${props.URI} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  MySQLConnection: {
    en: (props) => `found MySQL connection string: ${props.URI}`,
    ja: (props) => `MySQL\u63A5\u7D9A\u6587\u5B57\u5217: ${props.URI} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  PostgreSQLConnection: {
    en: (props) => `found PostgreSQL connection string: ${props.URI}`,
    ja: (props) => `PostgreSQL\u63A5\u7D9A\u6587\u5B57\u5217: ${props.URI} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var BUILTIN_IGNORED_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "example.com",
  "example.org",
  "test.com",
  "password",
  "username",
  "secret",
  "mypassword",
  "myusername",
  "root",
  "admin",
  "user",
  "pass",
  "{password}",
  "${password}",
  "{{password}}",
  "{username}",
  "${username}",
  "{{username}}",
  "YOUR_PASSWORD",
  "YOUR_USERNAME",
  "REPLACE_WITH_PASSWORD"
];
function isVariableLikeString(str) {
  const variablePatterns = [
    /\$\{[^}]{1,50}\}/,
    // ${var}
    /\{\{[^}]{1,50}\}\}/,
    // {{var}}
    /\{[^}]{1,50}\}/,
    // {var}
    /%[A-Z_]{1,30}%/,
    // %VAR%
    /\$[A-Z_]{1,30}/,
    // $VAR
    /\$\([^)]{1,50}\)/
    // $(var)
  ];
  return variablePatterns.some((pattern) => pattern.test(str));
}
function isLikelyRealCredential(username, password) {
  if (username === password)
    return false;
  if (password.length < 4)
    return false;
  if (isVariableLikeString(password))
    return false;
  const passwordLower = password.toLowerCase();
  if (BUILTIN_IGNORED_PATTERNS.some((pattern) => passwordLower === pattern.toLowerCase())) {
    return false;
  }
  if (/^(.)\1{3,}$/.test(password))
    return false;
  return true;
}
function reportMongoDBConnectionString({ source, options, context, t }) {
  const MONGODB_PATTERN = /mongodb(?:\+srv)?:\/\/(?:(?<username>[^:\/\s]{1,100}):(?<password>[^@\/\s]{1,200})@)?(?<host>[^\/\s?]{1,100})(?:\/(?<database>[^?\s]{0,100}))?(?:\?(?<options>[^\s]{0,500}))?/gi;
  const results = source.content.matchAll(MONGODB_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const username = result.groups?.username;
    const password = result.groups?.password;
    if (!username || !password)
      continue;
    if (!isLikelyRealCredential(username, password))
      continue;
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("MongoDBConnection", {
        URI: match
      }),
      range
    });
  }
}
function reportMySQLConnectionString({ source, options, context, t }) {
  const MYSQL_URI_PATTERN = /(?:jdbc:)?mysql(?:x)?:\/\/(?:(?<username>[^:\/\s]{1,100}):(?<password>[^@\/\s]{1,200})@)?(?<host>[^\/\s?]{1,100})(?:\/(?<database>[^?\s]{0,100}))?(?:\?(?<options>[^\s]{0,500}))?/gi;
  const results = source.content.matchAll(MYSQL_URI_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const username = result.groups?.username;
    const password = result.groups?.password;
    if (!username || !password)
      continue;
    if (!isLikelyRealCredential(username, password))
      continue;
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("MySQLConnection", {
        URI: match
      }),
      range
    });
  }
}
function reportPostgreSQLConnectionString({ source, options, context, t }) {
  const POSTGRESQL_URI_PATTERN = /postgres(?:ql)?:\/\/(?:(?<username>[^:\/\s]{1,100}):(?<password>[^@\/\s]{1,200})@)?(?<host>[^\/\s?]{1,100})(?:\/(?<database>[^?\s]{0,100}))?(?:\?(?<options>[^\s]{0,500}))?/gi;
  const results = source.content.matchAll(POSTGRESQL_URI_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const username = result.groups?.username;
    const password = result.groups?.password;
    if (!username || !password)
      continue;
    if (!isLikelyRealCredential(username, password))
      continue;
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("PostgreSQLConnection", {
        URI: match
      }),
      range
    });
  }
}
var creator$9 = {
  messages: messages$8,
  meta: {
    id: "@secretlint/secretlint-rule-database-connection-string",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-database-connection-string/README.md"
    }
  },
  create(context, options) {
    const normalizedOptions = {
      allows: options.allows || []
    };
    const t = context.createTranslator(messages$8);
    return {
      file(source) {
        reportMongoDBConnectionString({ source, options: normalizedOptions, context, t });
        reportMySQLConnectionString({ source, options: normalizedOptions, context, t });
        reportPostgreSQLConnectionString({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$7 = {
  HASHICORP_VAULT_SERVICE_TOKEN: {
    en: (props) => `found HashiCorp Vault service token: ${props.TOKEN}`,
    ja: (props) => `HashiCorp Vault service token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  HASHICORP_VAULT_BATCH_TOKEN: {
    en: (props) => `found HashiCorp Vault batch token: ${props.TOKEN}`,
    ja: (props) => `HashiCorp Vault batch token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  HASHICORP_VAULT_RECOVERY_TOKEN: {
    en: (props) => `found HashiCorp Vault recovery token: ${props.TOKEN}`,
    ja: (props) => `HashiCorp Vault recovery token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var serviceTokenPattern = new RegExp("(?<!\\p{L})hvs\\.[A-Za-z0-9_-]{90,120}(?![A-Za-z0-9_-])", "gu");
var batchTokenPattern = new RegExp("(?<!\\p{L})hvb\\.[A-Za-z0-9_-]{138,300}(?![A-Za-z0-9_-])", "gu");
var recoveryTokenPattern = new RegExp("(?<!\\p{L})hvr\\.[A-Za-z0-9_-]{90,120}(?![A-Za-z0-9_-])", "gu");
var creator$8 = {
  messages: messages$7,
  meta: {
    id: "@secretlint/secretlint-rule-hashicorp-vault",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-hashicorp-vault/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$7);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    const reportMatches = (source, pattern, messageId) => {
      const matches2 = source.content.matchAll(pattern);
      for (const match of matches2) {
        const index = match.index ?? 0;
        const matchString = match[0] ?? "";
        const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
        if (allowedResults.length > 0) {
          continue;
        }
        const range = [index, index + matchString.length];
        context.report({
          message: t(messageId, {
            TOKEN: matchString
          }),
          range
        });
      }
    };
    return {
      file(source) {
        reportMatches(source, serviceTokenPattern, "HASHICORP_VAULT_SERVICE_TOKEN");
        reportMatches(source, batchTokenPattern, "HASHICORP_VAULT_BATCH_TOKEN");
        reportMatches(source, recoveryTokenPattern, "HASHICORP_VAULT_RECOVERY_TOKEN");
      }
    };
  }
};
var messages$6 = {
  VERCEL_PERSONAL_ACCESS_TOKEN: {
    en: (props) => `found Vercel personal access token: ${props.ID}`,
    ja: (props) => `Vercel personal access token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  VERCEL_INTEGRATION_TOKEN: {
    en: (props) => `found Vercel integration token: ${props.ID}`,
    ja: (props) => `Vercel integration token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  VERCEL_APP_ACCESS_TOKEN: {
    en: (props) => `found Vercel app access token: ${props.ID}`,
    ja: (props) => `Vercel app access token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  VERCEL_APP_REFRESH_TOKEN: {
    en: (props) => `found Vercel app refresh token: ${props.ID}`,
    ja: (props) => `Vercel app refresh token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  VERCEL_AI_GATEWAY_API_KEY: {
    en: (props) => `found Vercel AI Gateway API key: ${props.ID}`,
    ja: (props) => `Vercel AI Gateway API key: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var prefixToMessageId = {
  vcp: "VERCEL_PERSONAL_ACCESS_TOKEN",
  vci: "VERCEL_INTEGRATION_TOKEN",
  vca: "VERCEL_APP_ACCESS_TOKEN",
  vcr: "VERCEL_APP_REFRESH_TOKEN",
  vck: "VERCEL_AI_GATEWAY_API_KEY"
};
var creator$7 = {
  messages: messages$6,
  meta: {
    id: "@secretlint/secretlint-rule-vercel",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-vercel/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$6);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})(?<prefix>vcp|vci|vca|vcr|vck)_[A-Za-z0-9]{20,60}(?![A-Za-z0-9])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const prefix = match.groups?.prefix;
          const messageId = prefixToMessageId[prefix];
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t(messageId, {
              ID: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$5 = {
  DATABRICKS_PERSONAL_ACCESS_TOKEN: {
    en: (props) => `found Databricks personal access token: ${props.ID}`,
    ja: (props) => `Databricks personal access token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$6 = {
  messages: messages$5,
  meta: {
    id: "@secretlint/secretlint-rule-databricks",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-databricks/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$5);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})dapi[A-Fa-f0-9]{32}(?:-[0-9])?(?![A-Fa-f0-9])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("DATABRICKS_PERSONAL_ACCESS_TOKEN", {
              ID: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$4 = {
  DOCKER_PERSONAL_ACCESS_TOKEN: {
    en: (props) => `found Docker Personal Access Token: ${props.TOKEN}`,
    ja: (props) => `Docker Personal Access Token: ${props.TOKEN} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
function reportIfFoundDockerPAT({ source, options, context, t }) {
  const DOCKER_PAT_PATTERN = new RegExp("(?<!\\p{L})dckr_pat_[a-zA-Z0-9_-]{27}(?![a-zA-Z0-9_-])", "gu");
  const results = source.content.matchAll(DOCKER_PAT_PATTERN);
  for (const result of results) {
    const index = result.index || 0;
    const match = result[0] || "";
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t("DOCKER_PERSONAL_ACCESS_TOKEN", {
        TOKEN: match
      }),
      range
    });
  }
}
var creator$5 = {
  messages: messages$4,
  meta: {
    id: "@secretlint/secretlint-rule-docker",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-docker/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$4);
    const normalizedOptions = {
      allows: options.allows || []
    };
    return {
      file(source) {
        reportIfFoundDockerPAT({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$3 = {
  FIGMA_PERSONAL_ACCESS_TOKEN: {
    en: (props) => `found Figma Personal Access Token: ${props.ID}`,
    ja: (props) => `Figma Personal Access Token: ${props.ID} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var creator$4 = {
  messages: messages$3,
  meta: {
    id: "@secretlint/secretlint-rule-figma",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-figma/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$3);
    const normalizedOptions = {
      allows: options?.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})figd_[A-Za-z0-9_-]{40,200}(?![A-Za-z0-9_-])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const range = [index, index + matchString.length];
          context.report({
            message: t("FIGMA_PERSONAL_ACCESS_TOKEN", {
              ID: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var messages$2 = {
  CLOUDFLARE_GLOBAL_API_KEY: {
    en: (props) => `found Cloudflare Global API Key: ${props.TOKEN}`,
    ja: (props) => `Cloudflare Global API Key\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.TOKEN}`
  },
  CLOUDFLARE_USER_API_TOKEN: {
    en: (props) => `found Cloudflare User API Token: ${props.TOKEN}`,
    ja: (props) => `Cloudflare User API Token\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.TOKEN}`
  },
  CLOUDFLARE_ACCOUNT_API_TOKEN: {
    en: (props) => `found Cloudflare Account API Token: ${props.TOKEN}`,
    ja: (props) => `Cloudflare Account API Token\u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${props.TOKEN}`
  }
};
var messageIdMap = {
  cfk: "CLOUDFLARE_GLOBAL_API_KEY",
  cfut: "CLOUDFLARE_USER_API_TOKEN",
  cfat: "CLOUDFLARE_ACCOUNT_API_TOKEN"
};
var CLOUDFLARE_TOKEN_PATTERN = new RegExp("(?<!\\p{L})(?<prefix>cfk|cfut|cfat)_[A-Za-z0-9]{40}[0-9a-f]{8}(?![A-Za-z0-9])", "gu");
function reportIfFound({ source, options, context, t }) {
  const results = source.content.matchAll(CLOUDFLARE_TOKEN_PATTERN);
  for (const result of results) {
    const index = result.index ?? 0;
    const match = result[0] ?? "";
    const prefix = result.groups?.["prefix"];
    if (!prefix) {
      continue;
    }
    const range = [index, index + match.length];
    const allowedResults = regexpStringMatcherExports.matchPatterns(match, options.allows);
    if (allowedResults.length > 0) {
      continue;
    }
    context.report({
      message: t(messageIdMap[prefix], {
        TOKEN: match
      }),
      range
    });
  }
}
var creator$3 = {
  messages: messages$2,
  meta: {
    id: "@secretlint/secretlint-rule-cloudflare",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-cloudflare/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$2);
    const normalizedOptions = {
      allows: options.allows ?? []
    };
    return {
      file(source) {
        reportIfFound({ source, options: normalizedOptions, context, t });
      }
    };
  }
};
var messages$1 = {
  TAILSCALE_API_KEY: {
    en: (props) => `found Tailscale API access token: ${props.KEY}`,
    ja: (props) => `Tailscale API \u30A2\u30AF\u30BB\u30B9\u30C8\u30FC\u30AF\u30F3: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  TAILSCALE_AUTH_KEY: {
    en: (props) => `found Tailscale pre-authentication key: ${props.KEY}`,
    ja: (props) => `Tailscale \u4E8B\u524D\u8A8D\u8A3C\u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  TAILSCALE_CLIENT_KEY: {
    en: (props) => `found Tailscale OAuth client key: ${props.KEY}`,
    ja: (props) => `Tailscale OAuth \u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  TAILSCALE_SCIM_KEY: {
    en: (props) => `found Tailscale SCIM key: ${props.KEY}`,
    ja: (props) => `Tailscale SCIM \u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  TAILSCALE_WEBHOOK_KEY: {
    en: (props) => `found Tailscale webhook key: ${props.KEY}`,
    ja: (props) => `Tailscale Webhook \u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  },
  TAILSCALE_KEY: {
    en: (props) => `found Tailscale key: ${props.KEY}`,
    ja: (props) => `Tailscale \u30AD\u30FC: ${props.KEY} \u304C\u307F\u3064\u304B\u308A\u307E\u3057\u305F`
  }
};
var messageIdByType = {
  api: "TAILSCALE_API_KEY",
  auth: "TAILSCALE_AUTH_KEY",
  client: "TAILSCALE_CLIENT_KEY",
  scim: "TAILSCALE_SCIM_KEY",
  webhook: "TAILSCALE_WEBHOOK_KEY"
};
var creator$2 = {
  messages: messages$1,
  meta: {
    id: "@secretlint/secretlint-rule-tailscale",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-tailscale/README.md"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages$1);
    const normalizedOptions = {
      allows: options.allows ?? []
    };
    return {
      file(source) {
        const pattern = new RegExp("(?<!\\p{L})tskey-(?<type>[a-z]{2,20})-[0-9A-Za-z_]{8,40}-[0-9A-Za-z_]{16,60}(?![0-9A-Za-z_])", "gu");
        const matches2 = source.content.matchAll(pattern);
        for (const match of matches2) {
          const index = match.index ?? 0;
          const matchString = match[0] ?? "";
          const type = match.groups?.type ?? "";
          const range = [index, index + matchString.length];
          const allowedResults = regexpStringMatcherExports.matchPatterns(matchString, normalizedOptions.allows);
          if (allowedResults.length > 0) {
            continue;
          }
          const messageId = messageIdByType[type] ?? "TAILSCALE_KEY";
          context.report({
            message: t(messageId, {
              KEY: matchString
            }),
            range
          });
        }
      }
    };
  }
};
var HTML_COMMENT_REGEXP = /(?<type>secretlint-(?:disable-next-line|disable-line|disable|enable))(?<options>.*)/g;
var parseComments = (source) => {
  const matches2 = source.content.matchAll(HTML_COMMENT_REGEXP);
  return Array.from(matches2).map((match) => {
    const type = match.groups?.type;
    const index = match.index;
    if (type === "secretlint-disable-line") {
      return {
        type,
        options: parseComment(match.groups?.options),
        line: source.indexToPosition(index).line
      };
    }
    if (type === "secretlint-disable-next-line") {
      return {
        type,
        options: parseComment(match.groups?.options),
        line: source.indexToPosition(index).line + 1
      };
    }
    return {
      type,
      options: parseComment(match.groups?.options),
      index
    };
  });
};
function parseComment(options) {
  if (!options) {
    return [];
  }
  const commentStart = options.indexOf("--");
  const ruleIdString = commentStart === -1 ? options : options.slice(0, commentStart);
  return ruleIdString.split(/,/).map((arg) => arg.trim()).filter((arg) => arg !== "") ?? [];
}
var CommentState = class {
  source;
  reportingConfig;
  endIndex;
  constructor(source) {
    this.source = source;
    this.reportingConfig = [];
    this.endIndex = source.content.length;
  }
  getIgnoringMessages() {
    const isFilledMessage = (message) => {
      return message.startIndex !== null && message.endIndex !== null && message.ruleId !== null;
    };
    return this.reportingConfig.map((reporting) => {
      if (reporting.endIndex === null) {
        reporting.endIndex = this.endIndex;
      }
      return reporting;
    }).filter(isFilledMessage);
  }
  disableLine(lineNumber, rulesToDisable) {
    const reportingConfig = this.reportingConfig;
    const range = this.source.locationToRange({
      start: {
        line: lineNumber,
        column: 0
      },
      end: {
        line: lineNumber + 1,
        column: 0
      }
    });
    if (rulesToDisable.length) {
      rulesToDisable.forEach((ruleId) => {
        reportingConfig.push({
          startIndex: range[0],
          endIndex: range[1] - 1,
          ruleId
        });
      });
    } else {
      reportingConfig.push({
        startIndex: range[0],
        endIndex: range[1] - 1,
        ruleId: "*"
      });
    }
  }
  /**
   * Add data to reporting configuration to disable reporting for list of rules
   * starting from start location
   * @returns {void}
   */
  disableReporting(startIndex, rulesToDisable) {
    const reportingConfig = this.reportingConfig;
    if (rulesToDisable.length) {
      rulesToDisable.forEach(function(ruleId) {
        reportingConfig.push({
          startIndex,
          endIndex: null,
          ruleId
        });
      });
    } else {
      reportingConfig.push({
        startIndex,
        endIndex: null,
        ruleId: "*"
      });
    }
  }
  /**
   * Add data to reporting configuration to enable reporting for list of rules
   * starting from start location
   */
  enableReporting(endIndex, rulesToEnable) {
    const reportingConfig = this.reportingConfig;
    if (rulesToEnable.length) {
      rulesToEnable.forEach(function(ruleId) {
        for (let i = reportingConfig.length - 1; i >= 0; i--) {
          if (reportingConfig[i].endIndex === null && reportingConfig[i].ruleId === ruleId) {
            reportingConfig[i].endIndex = endIndex;
            break;
          }
        }
      });
    } else {
      for (const config of reportingConfig) {
        if (config.endIndex === null) {
          config.endIndex = endIndex;
        }
      }
    }
  }
};
var messages = {
  IGNORE_MESSAGE: {
    en: () => `disable by secretlint-disable comment`
  }
};
var creator$1 = {
  messages,
  meta: {
    id: "@secretlint/secretlint-rule-filter-comments",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/secretlint/secretlint/blob/master/packages/%40secretlint/secretlint-rule-filter-comments/README.md"
    }
  },
  create(context) {
    const t = context.createTranslator(messages);
    return {
      file(source) {
        const state = new CommentState(source);
        const comments = parseComments(source);
        for (const comment of comments) {
          if (comment.type === "secretlint-disable") {
            state.disableReporting(comment.index, comment.options);
          } else if (comment.type === "secretlint-enable") {
            state.enableReporting(comment.index, comment.options);
          } else if (comment.type === "secretlint-disable-line") {
            state.disableLine(comment.line, comment.options);
          } else if (comment.type === "secretlint-disable-next-line") {
            state.disableLine(comment.line, comment.options);
          }
        }
        state.getIgnoringMessages().forEach((message) => {
          context.ignore({
            message: t("IGNORE_MESSAGE"),
            range: [message.startIndex, message.endIndex],
            targetRuleId: message.ruleId
          });
        });
      }
    };
  }
};
var rules = [
  creator$s,
  creator$r,
  creator$h,
  creator$q,
  creator$o,
  creator$p,
  creator$g,
  creator$f,
  creator$e,
  creator$d,
  creator$c,
  creator$b,
  creator$n,
  creator$m,
  creator$l,
  creator$k,
  creator$j,
  creator$i,
  creator$a,
  creator$9,
  creator$8,
  creator$7,
  creator$6,
  creator$5,
  creator$4,
  creator$3,
  creator$2,
  creator$1
];

// src/guard.mjs
var import_picomatch = __toESM(require_picomatch2(), 1);
var REDACTED = "[REDACTED]";
var defaults = {
  mode: "enforce",
  deny: [],
  ask: ["*.delete"],
  askOnDestructive: true,
  redact: true,
  denyPaths: ["**/.env", "**/*.pem"],
  secretPatterns: ["sk-[A-Za-z0-9_-]{8,}", "AKIA[0-9A-Z]{16}"]
};
var scannerRules = rules.filter((rule) => ![
  "@secretlint/secretlint-rule-comment-directive",
  "@secretlint/secretlint-rule-filter-comments"
].includes(rule.meta.id)).map((rule) => ({ id: rule.meta.id, rule, severity: "error", options: {} }));
var globOptions = { dot: true, nonegate: true, noextglob: true };
function loadConfig(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== "object") throw new Error("Invalid configuration");
  const config = { ...defaults, ...raw };
  if (!["enforce", "monitor"].includes(config.mode)) throw new Error("Invalid configuration");
  for (const key of ["redact", "askOnDestructive"]) {
    if (typeof config[key] !== "boolean") throw new Error("Invalid configuration");
  }
  for (const key of ["deny", "ask", "denyPaths", "secretPatterns"]) {
    if (!Array.isArray(config[key]) || config[key].some((v) => typeof v !== "string")) throw new Error("Invalid configuration");
  }
  return { ...config, patterns: config.secretPatterns.map((pattern) => new RegExp(pattern, "g")) };
}
function matches(patterns, value) {
  return patterns.some((pattern) => (0, import_picomatch.default)(pattern, globOptions)(value));
}
function pathArguments(value) {
  if (Array.isArray(value)) return value.flatMap(pathArguments);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => key === "path" && typeof item === "string" ? [item.replaceAll("\\", "/")] : pathArguments(item));
}
function pathCandidates(path2, cwd) {
  const candidates = [path2, normalize(path2).replaceAll("\\", "/")];
  let parent = resolve(cwd, path2);
  const tail = [];
  while (true) {
    try {
      candidates.push(join(realpathSync(parent), ...tail).replaceAll("\\", "/"));
      break;
    } catch {
      const next = dirname(parent);
      if (next === parent) break;
      tail.unshift(basename(parent));
      parent = next;
    }
  }
  return candidates;
}
function policy(payload, config) {
  const reasons = [];
  const tool = payload._harness?.tool ?? "";
  let decision = "allow";
  if (matches(config.deny, tool)) {
    decision = "deny";
    reasons.push("guard: denied by tool policy");
  }
  if (pathArguments(payload.tool_input).some((path2) => pathCandidates(path2, payload.cwd ?? process.cwd()).some((candidate) => matches(config.denyPaths, candidate)))) {
    decision = "deny";
    reasons.push("guard: denied by path policy");
  }
  if (decision !== "deny") {
    if (matches(config.ask, tool)) {
      decision = "ask";
      reasons.push("guard: approval required by tool policy");
    }
    if (config.askOnDestructive && payload._harness?.annotations?.destructiveHint === true) {
      decision = "ask";
      reasons.push("guard: approval required for destructive tool");
    }
  }
  return { decision, reasons };
}
async function redactString(text, config) {
  const scanned = await lintSource({
    source: { content: text, filePath: "/virtual/guard.txt", contentType: "text" },
    options: { config: { rules: scannerRules }, noPhysicFilePath: true, maskSecrets: true }
  });
  const ranges = [];
  for (const message of scanned.messages) {
    const range = message.range;
    if (message.ruleId !== "@secretlint/secretlint-rule-github" || !Array.isArray(range) || range.length !== 2 || !Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] < 0 || range[1] <= range[0] || range[1] > text.length || !/^(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)$/.test(text.slice(...range))) {
      return { value: REDACTED, count: 1 };
    }
    ranges.push(range);
  }
  for (const pattern of config.patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match[0].length > 0) ranges.push([match.index, match.index + match[0].length]);
    }
  }
  const merged = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  let value = text;
  for (const [start, end] of [...merged].reverse()) value = value.slice(0, start) + REDACTED + value.slice(end);
  return { value, count: merged.length };
}
async function redactValue(value, config) {
  if (typeof value === "string") return redactString(value, config);
  if (!value || typeof value !== "object") return { value, count: 0 };
  let count = 0;
  if (Array.isArray(value)) {
    const output = [];
    for (const item of value) {
      const result = await redactValue(item, config);
      output.push(result.value);
      count += result.count;
    }
    return { value: output, count };
  }
  const entries = [];
  for (const [key, item] of Object.entries(value)) {
    const result = await redactValue(item, config);
    const redactedKey = await redactString(key, config);
    entries.push([redactedKey.value, result.value]);
    count += result.count + redactedKey.count;
  }
  return { value: Object.fromEntries(entries), count };
}
var hashMetadata = (value) => "sha256:" + createHash("sha256").update(String(value ?? "")).digest("hex");
async function audit(payload, decision, reasons, redactions, config) {
  const directory = process.env.HARNESS_PLUGIN_DATA;
  if (!directory) throw new Error("Missing audit directory");
  mkdirSync(directory, { recursive: true, mode: 448 });
  const session = config ? (await redactString(String(payload.session_id ?? ""), config)).value : hashMetadata(payload.session_id);
  const tool = config ? (await redactString(String(payload._harness?.tool ?? ""), config)).value : hashMetadata(payload._harness?.tool);
  const fd = openSync(join(directory, "audit.jsonl"), constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW | constants.O_NONBLOCK, 384);
  try {
    if (!fstatSync(fd).isFile()) throw new Error("Invalid audit file");
    fchmodSync(fd, 384);
    appendFileSync(fd, JSON.stringify({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session,
      event: payload.hook_event_name,
      tool,
      decision,
      reasons,
      redactions
    }) + "\n");
  } finally {
    closeSync(fd);
  }
}
function emit(output) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: output }) + "\n");
}
async function main() {
  let payload;
  let rawConfig;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
    rawConfig = JSON.parse(process.env.HARNESS_PLUGIN_CONFIG ?? "{}");
    const config = loadConfig(rawConfig);
    const event = payload.hook_event_name;
    if (!["PreToolUse", "PostToolUse"].includes(event)) throw new Error("Unsupported event");
    const original = event === "PreToolUse" ? policy(payload, config) : { decision: "allow", reasons: [] };
    const source = event === "PreToolUse" ? payload.tool_input : payload.tool_response;
    const redaction = config.redact ? await redactValue(source, config) : { value: source, count: 0 };
    await audit(payload, original.decision, original.reasons, redaction.count, config);
    if (event === "PreToolUse" && original.decision === "deny" && config.mode === "enforce") {
      process.stderr.write(original.reasons.join("; ") + "\n");
      process.exitCode = 2;
      return;
    }
    const output = { hookEventName: event };
    if (event === "PreToolUse") {
      output.permissionDecision = config.mode === "monitor" ? "allow" : original.decision;
      if (original.reasons.length && config.mode !== "monitor") output.permissionDecisionReason = original.reasons.join("; ");
      if (redaction.count && config.mode !== "monitor") output.updatedInput = redaction.value;
    } else if (redaction.count && config.mode !== "monitor") output.updatedToolOutput = redaction.value;
    emit(output);
  } catch {
    const reason = "guard: configuration or processing failure";
    const event = payload?.hook_event_name;
    if (["PreToolUse", "PostToolUse"].includes(event)) {
      try {
        await audit(payload, "deny", [reason], 0, null);
      } catch {
      }
      if (rawConfig?.mode === "monitor") {
        emit({ hookEventName: event, ...event === "PreToolUse" ? { permissionDecision: "allow" } : {} });
        return;
      }
      if (event === "PostToolUse") {
        emit({ hookEventName: event, updatedToolOutput: {
          isError: true,
          content: [{ type: "text", text: REDACTED }]
        } });
        return;
      }
    }
    process.stderr.write(reason + "\n");
    process.exitCode = 2;
  }
}
await main();
