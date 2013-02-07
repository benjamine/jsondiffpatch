JsonDiffPatch
=========

*Diff & Patch for JavaScript objects and arrays (ie. any JSON serializable structure)*

JsonDiffPatch is a small library that allows to diff object graphs, create a patch (in pure JSON), and apply it to update an original version.

Now available on npm:
```
npm install jsondiffpatch
```
-----
**[DEMO](http://benjamine.github.com/JsonDiffPatch/demo/index.htm)**
-----
-----

- Could be used for logging, audit, remote (client-server) synchronization of changes, etc.
- Minified version is < 6KB
- Works in browsers and server (Node.j or any CommonJS env), open [test page](http://benjamine.github.com/JsonDiffPatch/test/qunit.htm) to check other browsers.
- Automatically detect environment support and load as CommonJS module (eg: node.js), anonymous AMD module (eg: using RequireJS on the browser, no globals), or as browser global.
- For long text diffs uses [google-diff_match_patch](http://code.google.com/p/google-diff-match-patch/) library if loaded (other text diff libs can be plugged in)
- Arrays diffs are smart!
  - Using [LCS](http://en.wikipedia.org/wiki/Longest_common_subsequence_problem) (the same type of algorithm used by popular text diff tools on lines of text) insertions and deletions are detected efficiently.
  - Also detects items moved on the same array (a refinement to LCS). Patching will only move the item in the array, and inner changes in the moved object are diffed/patched too.
  - Works with objects in the array if you provide a hash function, eg: ``` jsondiffpatch.config.objectHash = function(obj) { obj.id || JSON.stringify(obj); }; ```).
- Reverse a diff and unpatch (eg. revert object to its original state based on diff)
- Optional lib included for visualizing diffs as html

Example:

``` javascript
    // sample data
    var country = {
        name: "Argentina",
        capital: "Buenos Aires",
        independence: new Date(1816, 6, 9),
        unasur: true
    };
  
    // clone country, using dateReviver for Date objects
    var country2 = JSON.parse(JSON.stringify(country),jsondiffpatch.dateReviver);
     
    // make some changes
    country2.name = "República Argentina";
    country2.population = "41324992";
    delete country2.capital;
  
    var delta = jsondiffpatch.diff(country,country2);
    
    /*
    delta = {
        "name":["Argentina","República Argentina"], // old value, new value
        "population":["41324992"], // new value
        "capital":["Buenos Aires",0,0] // deleted
    }
    */
  
    // patch original 
    jsondiffpatch.patch(country, delta);

    // reverse diff
    var reverseDelta = jsondiffpatch.reverse(delta);
    // also country2 can be return to original value with: jsondiffpatch.unpatch(country2, delta);

    var delta2 = jsondiffpatch.diff(country,country2);
    
    // delta2 is undefined, no difference
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
            name: 'Córdoba',
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
            name: 'San Miguel de Tucumán',
            population: 800000,
        }
        ]
    };

    // clone country
    var country2 = JSON.parse(JSON.stringify(country));

    // delete Córdoba
    country.cities.splice(1, 1);

    // add La Plata
    country.cities.splice(4, 0, {
        name: 'La Plata'
        });

    // modify Rosario, and move it
    var rosario = country.cities.splice(1, 1)[0];
    rosario.population += 1234;
    country.cities.push(rosario);

    // match objects by name
    jsondiffpatch.config.objectHash = function(obj) {
        return obj.name;
    }

    var delta = jsondiffpatch.diff(country,country2);
    
    /*
    delta = {
        "cities": {
            "1": [
                // inserted at index 1
                {
                    "name": "Córdoba",
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
            "_t": "a",
            "_3": [
                // removed from index 3
                {
                    "name": "La Plata"
                },0,0],
            "_4": [
                // move from index 4 to index 2
                '',2,3]
        }
    }
    */
```

For more complex cases (nested objects or arrays, long text diffs) check unit tests in /test/test.js

To use as AMD module (eg: using RequireJS on the browser):

    require('jsondiffpatch', function(jsondiffpatch){

        // code using jsondiffpatch

    });

    // a module that depends on jsondiffpatch
    define('mytexteditor.visualcomparer', ['jsondiffpatch'], function(jsondiffpatch){

        // module implementation using jsondiffpatch

    });



Targeted platforms
----------------

* Tested on Chrome, FireFox, IE7+, to check other browsers open [test page](http://benjamine.github.com/JsonDiffPatch/test/qunit.htm) to run unit tests.
* Node.js

[QUnit](http://docs.jquery.com/Qunit) is used for unit testing. 
Just open the [test page](http://benjamine.github.com/JsonDiffPatch/test/qunit.htm) on your preferred browser. 

To run tests on Node.js on jsondiffpatch root folder:

```
    npm i
    npm test
```

Minification
----------------

A minified version is provided as jsondiffpatch.min.js
To regenerate that file run (npm i is required as uglifyjs is used):

```
    npm i
    npm run-script minify
```

Including JsonDiffPatch in your application
---------------

Install using npm:

```
npm install jsondiffpatch
```

or, Download the latest release from the web site (http://github.com/benjamine/JsonDiffPatch) and copy 
`jsondiffpatch.min.js` to a suitable location. To support text diffs include Google's diff_match_patch.

Then include it in your HTML
like so:

    <script type="text/javascript" src="/path/to/jsondiffpatch.min.js"></script>
    <script type="text/javascript" src="/path/to/diff_match_patch_uncompressed.js"></script>
    
Note: you can use JsonDiffPatch on browserless JavaScript environments too (as [Node.js](http://nodejs.org/), or [Mozilla Rhino](http://www.mozilla.org/rhino/)). 

On Node.js you have to connect your text diff/patch library explicitly. eg:

    var jsondiffpatch = require('./jsondiffpatch.js');
    
    // load google diff_match_patch library for text diff/patch 
    jsondiffpatch.config.diff_match_patch = require('./diff_match_patch_uncompressed.js');
    
    // use text diff for strings longer than 5 chars 
    jsondiffpatch.config.textDiffMinLength = 5;
    
    var d = jsondiffpatch.diff({ age: 5, name: 'Arturo' }, {age: 7, name: 'Armando' });
    // d = { 
    //   age: [ 5, 7 ],
    //   name: [ '@@ -1,6 +1,7 @@\n Ar\n-tur\n+mand\n o\n', 0, 2 ] }
    
    console.log(d.name[0])
    // prints: 
    // @@ -1,6 +1,7 @@
    // Ar
    // -tur
    // +mand
    //  o


Visual Diff
----------------

To visualize diffs you can include JsonDiffPatch.Html script + css on your page:

    <script type="text/javascript" src="/path/to/jsondiffpatch.html.js"></script>
    <link rel="stylesheet" href="../src/jsondiffpatch.html.css" type="text/css" />
Now you can use the jsondiffpatch.html.diffToHtml() function to visualize diffs as html:

```
    var json1 = JSON.parse($('#json1').val());
    var json2 = JSON.parse($('#json2').val());
    var d = jsondiffpatch.diff(json1, json2);
    $('#myvisualdiffcontainer').empty().append(jsondiffpatch.html.diffToHtml(json1, json2, d));
```

To see this in action check the [DEMO](http://benjamine.github.com/JsonDiffPatch/demo/index.htm) page.

Also you can generate diffs with jsondiffpatch on your console:

```
jsondiffpatch .\test\testdata.json .\test\testdata2.json
```
