// Syntax (parser and stringifier).

module.exports = (function() {

  var Core = require("./core.js");

  // String * Int -> {term: Term, deps: [String], index: Int}
  // Parses a source string to a Sol term. May receive a list of types for free
  // vars. Returns the term and a list of free vars.
  function parse(source, index) {
    var index = index || 0;
    var deps = [];
    var used = {};

    var term = (function parse() {
      while (/[^a-zA-Z\(\)_0-9\.@:\-\*\%\#\{\}\[\]]/.test(source[index]||""))
        ++index;

      if (source[index] === "(") {
        ++index;
        var app = parse();
        var arg = [];
        while (source[index] !== ")") {
          arg.push(parse());
          while (/\s/.test(source[index])) ++index;
        };
        ++index;
        return function(depth, binders, aliases) {
          var appTerm = app(depth, binders, aliases);
          for (var i=0, l=arg.length; i<l; ++i)
            appTerm = Core.App(appTerm, arg[i](depth, binders, aliases));
          return appTerm; 
        };

      } else if (source[index] === "*") {
        ++index;
        return function(depth, binders, aliases) {
          return Core.Set;
        };

      } else {
        var binder = "";
        while (/[a-zA-Z0-9_]/.test(source[index]||""))
          binder += source[index++];
        if (source[index] === ":") {
          ++index;
          var type = parse();
          var body = parse();
          return function(depth, binders, aliases) {
            return Core.Lam(
              type(depth, binders, aliases),
              body(depth+1, binders.concat(binder), aliases));
          };
        } else if (source[index] === ".") {
          ++index;
          var type = parse();
          var body = parse();
          return function(depth, binders, aliases) {
            return Core.For(
              type(depth, binders, aliases),
              body(depth+1, binders.concat(binder), aliases));
          };
        } else if (source[index] === "@") {
          ++index;
          var body = parse();
          return function(depth, binders, aliases) {
            return Core.Fix(body(depth+1, binders.concat(binder), aliases));
          };
        } else if (source[index] === "=") {
          ++index;
          var value = parse();
          var context = parse();
          return function(depth, binders, aliases) {
            var newAliases = {};
            for (var key in aliases)
              newAliases[key] = aliases[key];
            newAliases[binder] = value;
            return context(depth, binders, newAliases);
          };

        } else{
          return function(depth, binders, aliases) {
            var binderIndex = binders.lastIndexOf(binder);
            if (binderIndex === -1) {
              if (aliases[binder]) {
                return aliases[binder](depth, binders, aliases);
              };
              if (!(used[binder] < 0)) {
                deps.push(binder);
                binderIndex = -deps.length;
                used[binder] = binderIndex;
              } else {
                binderIndex = used[binder];
              }
            }
            return Core.Var(depth - binderIndex - 1);
          };
        };
      }
    })()(0, [], []);
    return {term: term, deps: deps, index: index};
  };

  // String -> Term
  function read(source) {
    return parse(source).term;
  };

  // Number -> String
  // Turns a number into a var name (a, b, c... aa, ab...).
  function toName(nat) {
    var alphabet = "abcdefghijklmnopqrstuvwxyz";
    var name = "";
    do {
      name += alphabet[nat % alphabet.length];
      nat = Math.floor(nat / alphabet.length);
    } while (nat > 0);
    return name;
  };

  // Term, (Term -> Maybe String) -> String
  // Stringifies a term. `combinatorName` is called on each combinator and may
  // return a name for it.
  function format(term, combinatorName) {
    if (!term) return "E";

    function extend(a,b) {
      var c = {};
      for (var key in a) c[key] = a[key];
      for (var key in b) c[key] = b[key];
      return c;
    };

    // Merges 2 scopes
    function merge(a,b) {
      var c = [];
      for (var ai=0, bi=0, al=a.length, bl=b.length; ai<al || bi < bl;)
        c.push( ai === al ? b[bi++]
              : bi === bl ? a[ai++]
              : a[ai][0] < b[bi][0] ? a[ai++]
              : b[bi][0] < a[ai][0] ? b[bi++]
              : [a[ai][0], extend(a[ai++][1],b[bi++][1])]);
      return c;
    };

    // Next scope
    function minVar(a) {
      for (var i=0; i<4294967296; ++i)
        if (!a[i])
          return i;
    };

    function next(a) {
      var bound = a[0] && a[0][0] === 0;
      var ext = {};
      if (bound)
        ext[minVar(a[0][1])] = 1;
      var c = [];
      for (var i=bound?1:0, l=a.length; i<l; ++i)
        c.push([a[i][0]-1, extend(a[i][1], ext)]);
      return c;
    };

    // Generates clean variable names
    (function go(term) {
      switch (term.ctor) {
        case Core.VAR: return [[term.idx, {}]];
        case Core.APP: return merge(go(term.fun), go(term.arg));
        case Core.LAM:
        case Core.FOR:
          var scope = go(term.bod);
          if (scope[0] && scope[0][0] === 0)
            term.arg = minVar(scope[0][1]); // ugly side-effective hack
          var nextScope = merge(go(term.typ), next(scope));
          term.isCombinator = nextScope.length === 0;
          return nextScope;
        case Core.FIX:
          var scope = go(term.ter);
          if (scope[0] && scope[0][0] === 0)
            term.arg = minVar(scope[0][1]); // ugly side-effective hack
          var nextScope = next(scope);
          term.isCombinator = nextScope.length === 0;
          return nextScope;
        default: return [];
      };
    })(term);

    // Returns the string
    return (function go(term, args) {
      if (term.isCombinator && combinatorName && combinatorName(term))
        return combinatorName(term);
      switch (term.ctor) {
        case Core.VAR: return args[args.length-term.idx-1] || (term.idx>0?"v"+term.idx:"f"+(-term.idx));
        case Core.APP: 
          var apps = [];
          for (var app = term; app.ctor === Core.APP; app = app.fun)
            apps.push(go(app.arg, args));
          apps.push(go(app, args));
          return "("+apps.reverse().join(" ")+")";
        case Core.LAM: 
          var arg = term.arg >= 0 ? toName(term.arg) : "";
          var typ = go(term.typ, args);
          var bod = go(term.bod, args.concat([arg]));
          return "("+arg+":"+typ+" "+bod+")";
        case Core.FOR: 
          var arg = term.arg >= 0 ? toName(term.arg) : "";
          var typ = go(term.typ, args);
          var bod = go(term.bod, args.concat([arg]));
          return "("+arg+"."+typ+" "+bod+")";
        case Core.FIX: 
          var arg = term.arg >= 0 ? toName(term.arg) : "";
          var bod = go(term.ter, args.concat([arg]));
          return arg+"@"+bod;
        case Core.SET: return "*";
      };
    })(term, []);
  };

  // Term -> String
  function show(term) {
    return format(term, function(term) { return null; });
  };

  // Term -> IO
  function print(term) {
    console.log(show(term));
  };

  return {
    parse: parse,
    format: format,
    read: read,
    show: show,
    print: print
  }
})();
