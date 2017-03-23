var postcss = require('postcss');
var _ = require('lodash');

var defaultOptions = {
  process: function(fontFamily) {
    return fontFamily;
  }
};

module.exports = postcss.plugin('postcss-font-local-name', function(opts) {
  opts = _.defaults(opts || {}, defaultOptions);
  if (typeof opts.process !== 'function') {
    console.warn('Warming! postcss-font-local-name. Process option is not a function. Used default processor')
    opts.process = defaultOptions.process;
  }

  function getQuoteless(string) {
    return string.replace(/^(['"])(.+)\1$/g, '$2');
  }

  return function (css) {
    var fontFamilies = {};

    css.walkAtRules('font-face', function(rule) {
      rule.walkDecls('font-family', function (decl) {
        var family = getQuoteless(decl.value).trim();
        decl.value = fontFamilies[family] = opts.process(family);
      });
    });

    var fontFamiliesRegexp = Object.keys(fontFamilies).map(function(fontFamily) {
      return fontFamily.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
    });

    css.walkRules(/^(?!@font-face).+$/, function(rule) {
      rule.walkDecls(/^(font-family|font)$/, function(decl) {
        decl.value = decl.value.replace( new RegExp('(' + fontFamiliesRegexp.join('|') + ')', 'g'), function(m, font) {
          return fontFamilies[font];
        });
      });
    });
  };
});
