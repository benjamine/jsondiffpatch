jsondiffpatch
=============

<!--- badges -->
[![Build Status](https://secure.travis-ci.org/benjamine/jsondiffpatch.svg)](http://travis-ci.org/benjamine/jsondiffpatch)
[![Code Climate](https://codeclimate.com/github/benjamine/jsondiffpatch/badges/gpa.svg)](https://codeclimate.com/github/benjamine/jsondiffpatch)
[![Test Coverage](https://codeclimate.com/github/benjamine/jsondiffpatch/badges/coverage.svg)](https://codeclimate.com/github/benjamine/jsondiffpatch)
[![NPM version](https://badge.fury.io/js/jsondiffpatch.svg)](http://badge.fury.io/js/jsondiffpatch)
[![NPM dependencies](https://david-dm.org/benjamine/jsondiffpatch.svg)](https://david-dm.org/benjamine/jsondiffpatch)

Diff & patch JavaScript objects

-----
**[Live Demo](http://benjamine.github.com/jsondiffpatch/demo/index.html)**
-----

- min+gzipped ~ 16KB
- browser and server (`/dist` folder with bundles for UMD, commonjs, or ES modules)
- (optionally) uses [google-diff-match-patch](http://code.google.com/p/google-diff-match-patch/) for long text diffs (diff at character level)
- smart array diffing using [LCS](http://en.wikipedia.org/wiki/Longest_common_subsequence_problem), ***IMPORTANT NOTE:*** to match objects inside an array you must provide an ```objectHash``` function (this is how objects are matched, otherwise a dumb match by position is used). For more details, check [Array diff documentation](docs/arrays.md)
- reverse a delta
- unpatch (eg. revert object to its original state using a delta)
- simplistic, pure JSON, low footprint [delta format](docs/deltas.md)
- multiple output formatters:
    - html (check it at the [Live Demo](http://benjamine.github.com/jsondiffpatch/demo/index.html))
    - annotated json (html), makes the JSON delta format self-explained
    - console (colored), try running ```./node_modules/.bin/jsondiffpatch left.json right.json```
    - JSON Patch format RFC 6902 support
    - write your own! check [Formatters documentation](docs/formatters.md)
- BONUS: `jsondiffpatch.clone(obj)` (deep clone)

Supported platforms
----------------

* Any modern browser and IE8+

[![Testling Status](https://ci.testling.com/benjamine/jsondiffpatch.png)](https://ci.testling.com/benjamine/jsondiffpatch)

And you can test your current browser visiting the [test page](http://benjamine.github.com/jsondiffpatch/test/index.html).

* Node.js [![Build Status](https://secure.travis-ci.org/benjamine/jsondiffpatch.svg)](http://travis-ci.org/benjamine/jsondiffpatch) v8+

Usage
-----

``` javascript
    // sample data
    var country = {
        name: "Argentina",
        capital: "Buenos Aires",
        independence: new Date(1816, 6, 9),
        unasur: true
    };

    // clone country, using dateReviver for Date objects
    var country2 = JSON.parse(JSON.stringify(country), jsondiffpatch.dateReviver);

    // make some changes
    country2.name = "Republica Argentina";
    country2.population = 41324992;
    delete country2.capital;

    var delta = jsondiffpatch.diff(country, country2);

    assertSame(delta, {
        "name":["Argentina","Republica Argentina"], // old value, new value
        "population":["41324992"], // new value
        "capital":["Buenos Aires", 0, 0] // deleted
    });

    // patch original
    jsondiffpatch.patch(country, delta);

    // reverse diff
    var reverseDelta = jsondiffpatch.reverse(delta);
    // also country2 can be return to original value with: jsondiffpatch.unpatch(country2, delta);

    var delta2 = jsondiffpatch.diff(country, country2);
    assert(delta2 === undefined)
    // undefined => no difference
```

Array diffing:

``` javascript
    // sample data
    var country = {
        name: "Argentina",
        cities: [
        {
            name: 'Buenos Aires',
            population: 13028000,
        },
        {
            name: 'Cordoba',
            population: 1430023,
        },
        {
            name: 'Rosario',
            population: 1136286,
        },
        {
            name: 'Mendoza',
            population: 901126,
        },
        {
            name: 'San Miguel de Tucuman',
            population: 800000,
        }
        ]
    };

    // clone country
    var country2 = JSON.parse(JSON.stringify(country));

    // delete Cordoba
    country.cities.splice(1, 1);

    // add La Plata
    country.cities.splice(4, 0, {
        name: 'La Plata'
        });

    // modify Rosario, and move it
    var rosario = country.cities.splice(1, 1)[0];
    rosario.population += 1234;
    country.cities.push(rosario);

    // create a configured instance, match objects by name
    var diffpatcher = jsondiffpatch.create({
        objectHash: function(obj) {
            return obj.name;
        }
    });

    var delta = diffpatcher.diff(country, country2);

    assertSame(delta, {
        "cities": {
            "_t": "a", // indicates this node is an array (not an object)
            "1": [
                // inserted at index 1
                {
                    "name": "Cordoba",
                    "population": 1430023
                }]
            ,
            "2": {
                // population modified at index 2 (Rosario)
                "population": [
                    1137520,
                    1136286
                ]
            },
            "_3": [
                // removed from index 3
                {
                    "name": "La Plata"
                }, 0, 0],
            "_4": [
                // move from index 4 to index 2
                '', 2, 3]
        }
    });
```

For more example cases (nested objects or arrays, long text diffs) check ```test/examples/```

If you want to understand deltas, see [delta format documentation](docs/deltas.md)

Installing
---------------

### NPM

This works for node, or in browsers if you already do bundling on your app

``` sh
npm install jsondiffpatch
```

``` js
var jsondiffpatch = require('jsondiffpatch').create(options);
```

### browser

In a browser, you could load directly a bundle in `/dist`, eg. `/dist/jsondiffpatch.umd.js`.

Options
-------

``` javascript
var jsondiffpatch = require('jsondiffpatch').create({
    // used to match objects when diffing arrays, by default only === operator is used
    objectHash: function(obj) {
        // this function is used only to when objects are not equal by ref
        return obj._id || obj.id;
    },
    arrays: {
        // default true, detect items moved inside the array (otherwise they will be registered as remove+add)
        detectMove: true,
        // default false, the value of items moved is not included in deltas
        includeValueOnMove: false
    },
    textDiff: {
        // default 60, minimum string length (left and right sides) to use text diff algorythm: google-diff-match-patch
        minLength: 60
    },
    propertyFilter: function(name, context) {
      /*
       this optional function can be specified to ignore object properties (eg. volatile data)
        name: property name, present in either context.left or context.right objects
        context: the diff context (has context.left and context.right objects)
      */
      return name.slice(0, 1) !== '$';
    },
    cloneDiffValues: false /* default false. if true, values in the obtained delta will be cloned
      (using jsondiffpatch.clone by default), to ensure delta keeps no references to left or right objects. this becomes useful if you're diffing and patching the same objects multiple times without serializing deltas.
      instead of true, a function can be specified here to provide a custom clone(value)
      */
});
```

Visual Diff
-----------

``` html
<!DOCTYPE html>
<html>
    <head>
        <script type='text/javascript' src="https://cdn.jsdelivr.net/npm/jsondiffpatch/dist/jsondiffpatch.umd.min.js"></script>
        <link rel="stylesheet" href="./style.css" type="text/css" />
        <link rel="stylesheet" href="../formatters-styles/html.css" type="text/css" />
        <link rel="stylesheet" href="../formatters-styles/annotated.css" type="text/css" />
    </head>
    <body>
        <div id="visual"></div>
        <hr/>
        <div id="annotated"></div>
        <script>
            var left = { a: 3, b: 4 };
            var right = { a: 5, c: 9 };
            var delta = jsondiffpatch.diff(left, right);

            // beautiful html diff
            document.getElementById('visual').innerHTML = jsondiffpatch.formatters.html.format(delta, left);

            // self-explained json
            document.getElementById('annotated').innerHTML = jsondiffpatch.formatters.annotated.format(delta, left);
        </script>
    </body>
</html>
```

To see formatters in action check the [Live Demo](http://benjamine.github.com/jsondiffpatch/demo/index.html).

For more details check [Formatters documentation](docs/formatters.md)

Console
--------

``` sh
# diff two json files, colored output (using chalk lib)
./node_modules/.bin/jsondiffpatch ./left.json ./right.json

# or install globally
npm install -g jsondiffpatch

jsondiffpatch ./demo/left.json ./demo/right.json
```

![console_demo!](docs/demo/consoledemo.png)

Plugins
-------

```diff()```, ```patch()``` and ```reverse()``` functions are implemented using Pipes & Filters pattern, making it extremely customizable by adding or replacing filters on a pipe.

Check [Plugins documentation](docs/plugins.md) for details.
