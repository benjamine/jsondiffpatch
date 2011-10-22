JsonDiffPatch
=========

*Diff & Patch for JavaScript objects and arrays (ie. any JSON serializable structure)*

JsonDiffPatch is a small library that allows to diff to Javascript object trees, create a patch and apply it to update the original version.

- Could be used for logging, audit, remote (client-server) synchronization of changes, etc.
- Works in browsers and server (Node.js), use test/qunit.htm to test it in any browser/environment.
- Automatically uses google diff_match_patch library for long texts when available (finds diff_match_patch global, other text diff libs can be plugged in)
- Array can be diffed matching items by key, just provide add a "_key" property the array (in any of both versions). item position will be ignored.

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
  
	var delta2 = jsondiffpatch.diff(country,country2);
  // delta2 is undefined, no difference

For more complex cases (nested objects, arrays, long text diffs) check unit tests in /test/test.js

---------------


Targeted platforms
----------------

* All modern browsers, open test/qunit.htm in a browser to run unit tests.
* Node.js

[QUnit](http://docs.jquery.com/Qunit) is used for unit testing. 
Just open the [test page](http://benjamine.github.com/jsondiffpatch/test/qunit.htm) on your preferred browser. 

Including JsonDiffPatch in your application
---------------

Download the latest release from the web site (http://github.com/benjamine/jsondiffpatch) and copy 
`src/jsondiffpatch.js` to a suitable location. To support text diffs include Google's diff_match_patch,
a version fixed to work in browsers as wall as in node.js is provided.

Then include it in your HTML
like so:

    <script type="text/javascript" src="/path/to/jsondiffpatch.js"></script>
    <script type="text/javascript" src="/path/to/diff_match_patch_uncompressed.js"></script>
	
Note: you can use JsonDiffPatch on browserless JavaScript environments too (as [Node.js](http://nodejs.org/), or [Mozilla Rhino](http://www.mozilla.org/rhino/)). 


Running Unit Tests
----------------

Just open test/qunit.htm file on any browser, tests will be run on load.
