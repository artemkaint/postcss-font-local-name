/* Required
   ========================================================================== */

var fs = require('fs');
var path = require('path');
var postcss = require('postcss');
var _ = require('lodash');

var defaultOptions = {
	localIdentName: 'localIdentName=[local]___[hash:base64:5]'
};

function getFont(family, opts) {
	return opts.localIdentName || family;
}

function getFormatHint(formatHints, extension) {
	return '"' + (formatHints[extension] || extension) + '"';
}

function getMethod(name, params) {
	return name + '(' + params + ')';
}

function getQuoteless(string) {
	return string.replace(/^(['"])(.+)\1$/g, '$2');
}

function getSafelyQuoted(string) {
	string = getQuoteless(string);

	return string.match(/\s/) ? '"' + string + '"' : string;
}

function getFirstFontFamily(decl) {
	return getQuoteless(
		postcss.list.space(
			postcss.list.comma(decl.value)[0]
		).slice(-1)[0]
	);
}

function getFontFaceRules(family, opts) {
	// set the font face rules array
	var fontFaceRules = [];

	// get the font
	var font = getFont(family, opts);

	// conditionally return early if no font is found
	if (!font) return fontFaceRules;

	// for each font style
	Object.keys(font.variants).forEach(function (style) {
		// set the font weights
		var weights = font.variants[style];

		// for each font weight
		Object.keys(weights).forEach(function (weight) {
			// set the urls
			var urls = weights[weight];

			// set the sources array
			var sources = [];

			// for each format
			opts.formats.forEach(function (format) {
				// if the format is local
				if (format === 'local') {
					// conditionally return early if no locals are available
					if (!urls.local) return;

					// for each local font
					urls.local.forEach(function (local) {
						// set the source as the local font
						var source = getMethod('local', getSafelyQuoted(local));

						// add the source to the sources array
						sources.push(source);
					});
				} else {
					// conditionally return early if no urls are available
					if (!urls.url) return;

					// set the url
					var url = urls.url[format];

					// conditionally return early if no url is available
					if (!url) return;

					// remove the http/https protocol
					url = url.replace(/^https?:/, '');

					// add the IE hack
					if (format === 'eot') url += '?#';

					// set the format hint
					var formatHint = getFormatHint(opts.formatHints, format);

					// set the source as the url and format hint
					var source = getMethod('url', url) + ' ' + getMethod('format', formatHint);

					// push the source to the sources array
					sources.push(source);
				}
			});

			// if the sources array is filled
			if (sources.length) {
				// create a font face rule
				var fontFaceRule = postcss.atRule({
					name: 'font-face'
				});

				// append a font-family declaration
				fontFaceRule.append(postcss.decl({
					prop:  'font-family',
					value: getSafelyQuoted(family)
				}));

				// append a font-style declaration
				fontFaceRule.append(postcss.decl({
					prop:  'font-style',
					value: style
				}));

				// append a font-weight declaration
				fontFaceRule.append(postcss.decl({
					prop:  'font-weight',
					value: weight
				}));

				// append a src declaration
				fontFaceRule.append(postcss.decl({
					prop:  'src',
					value: sources.join(',')
				}));

				// push the font face rule to the font face rules array
				fontFaceRules.push(fontFaceRule);
			}
		});
	});

	// return the font face rules array
	return fontFaceRules;
}

function plugin(opts) {
	// get configured option
	opts = _.defaults(opts || {}, defaultOptions);

	// return the plugin
	return function (css) {
		// set font families in use
		var fontFamiliesDeclared = {};

		// for each font face rule
		css.walkAtRules('font-face', function (rule) {
			// for each font-family declaration
			rule.walkDecls('font-family', function (decl) {
				// set the font family
				var family = getQuoteless(decl.value);

				// set the font family as declared
				fontFamiliesDeclared[family] = decl;
			});
		});

		// for each font declaration
		css.walkDecls(/^font(-family)?$/, function (decl) {
			// set the font family as the first declared font family
			var family = getFirstFontFamily(decl);

			// if the font family is not declared
			if (!fontFamiliesDeclared[family]) {
				// set the font family as declared
				fontFamiliesDeclared[family] = true;

				// set the font face rules
				var fontFaceRules = getFontFaceRules(family, opts);

				// if the font face rules array is filled
				if (fontFaceRules.length) {
					// prepend the font face rules
					css.prepend(fontFaceRules);
				}
			}
		});
	};
}

// set plugin
module.exports = postcss.plugin('postcss-font-local-name', plugin);

// stand-alone process method
module.exports.process = function (css, opts) {
	var processed = postcss([module.exports(opts)]).process(css, opts);

	return opts && opts.map && !opts.map.inline ? processed : processed.css;
};
