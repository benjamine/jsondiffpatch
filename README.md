JsonDiffPatch
=========

*Diff & Patch for JavaScript objects and arrays (ie. any JSON serializable structure)*

JsonDiffPatch is a small library that allows to diff to Javascript object trees, create a patch and apply it to update the original version.

-----
**[DEMO](http://benjamine.github.com/JsonDiffPatch/demo/index.htm)**
-----
-----

- Could be used for logging, audit, remote (client-server) synchronization of changes, etc.
- Works in browsers and server (Node.js), use test/qunit.htm to test it in any browser/environment. JsonDiffPatch will automatically detect environment support and load as CommonJS module (eg: node.js), anonymous AMD module (eg: using RequireJS on the browser), or as browser global.
- Automatically uses [google-diff_match_patch](http://code.google.com/p/google-diff-match-patch/) library for long texts when available (finds diff_match_patch global, other text diff libs can be plugged in)
- Array can be diffed matching items by key, just provide add a "_key" property the array (in any of both versions). item position will be ignored.
- Support for reverse a diff and unpatching (reverse patching)

eg:

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

For more complex cases (nested objects, arrays, long text diffs) check unit tests in /test/test.js

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

To run tests on Node.js

	npm test


Including JsonDiffPatch in your application
---------------

Download the latest release from the web site (http://github.com/benjamine/JsonDiffPatch) and copy 
`src/jsondiffpatch.js` to a suitable location. To support text diffs include Google's diff_match_patch.

Then include it in your HTML
like so:

    <script type="text/javascript" src="/path/to/jsondiffpatch.js"></script>
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

    var json1 = JSON.parse($('#json1').val());
    var json2 = JSON.parse($('#json2').val());
    var d = jsondiffpatch.diff(json1, json2);
    $('#myvisualdiffcontainer').empty().append(jsondiffpatch.html.diffToHtml(json1, json2, d));


To see this in action check the [DEMO](http://benjamine.github.com/JsonDiffPatch/demo/index.htm) page.
