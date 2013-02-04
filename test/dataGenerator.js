// This is a node app. Run it on the command line:
// 'node generator.js --input input.json --output testData.js --outputMutations 1000'

// Step 1. Parse arguments to override defaults
var args = {"input": "dataGeneratorInput.json", "output": "data.js", "outputMutations": 1000};
var argKey = null;

process.argv.forEach(function (val, index, array) {
  if (index < 2)
    return;
  if (argKey) {
    args[argKey] = val;
    argKey = null;
  } else {
    argKey = val;
  }
});

// Step 2. Read in the input JSON and compact it
var fs = require('fs');
var jsonString = JSON.stringify(JSON.parse(fs.readFileSync(args['input'], 'utf8')));
var rootNode = null;

// Step 3: Generate an output javascript file that contains
// mutated versions of the input JSON
var content = 'var originalJSON = JSON.parse("'+jsonString.replace(/"/g, '\\"') + '");';
content += '\rvar modifiedJSON = [];';

for (var mutation = 0; mutation < args['outputMutations']; mutation ++) {
  rootNode = JSON.parse(jsonString);
  content += '\nmodifiedJSON.push(JSON.parse("'+JSON.stringify(_modifyNode(rootNode)).replace(/"/g, '\\"') + '"));';
}

fs.writeFileSync(args['output'], content);


// -- Helper Functions --//

// Convenience method for generating a random number within a bound.
function intRandom(lower, upper) {
  return Math.floor(Math.random() * ((upper - lower) + 1)) + lower;
};

// Makes arbitrary mutations to the provided jsonNode based on it's type.
// In arrays, elements can be removed, added, or shifted. In objects, keys
// can be removed, added, or renamed. The number of changes made to the
// node is Math.ceil(Object.keys(jsonNode).length / 5), so at least one for
// every object or array.

function _modifyNode(jsonNode)
{
  if ((jsonNode instanceof Object) || (jsonNode instanceof Array)) {
    // instruct each sub-node to modify itself
    for (key in jsonNode) {
      if (intRandom(0, 15) == 0) {
        _rerootKeyFromNode(jsonNode, key)
        continue;
      }
      jsonNode[key] = _modifyNode(jsonNode[key])
    }
    var keys = Object.keys(jsonNode);
    var changeCount = Math.ceil(keys.length / 5);
    var changesMade = 0;

    // make some changes to the current node
    while (changesMade < changeCount) {
      if (jsonNode instanceof Array) {
        _modifyArrayNodeOnce(jsonNode);
        changesMade ++;

      } else if (jsonNode instanceof Object) {
        _modifyObjectNodeOnce(jsonNode);
        changesMade ++;
      }
    }

  } else {
    if (intRandom(0, 4) == 0) {
      // choose a new random value every so often
      jsonNode = Math.random().toString(36).substring(10);
    }
  }
  return jsonNode;
}

// Makes one random modification to a Javascript Object.
// Keys can be removed, added, or renamed.
function _modifyObjectNodeOnce(jsonNode)
{
  // available changes: remove key, rename key, add key
  var keys = Object.keys(jsonNode);
  switch (intRandom(0,2)) {
  case 0: // remove key
    keyIndex = intRandom(0, keys.length - 1);
    console.log('objectChange: remove key ' + keyIndex);
    delete jsonNode[keys[keyIndex]];
    keys.splice(keyIndex, 1);
    break;

  case 1: // rename key
    keyIndex = intRandom(0, keys.length - 1);
    keyNewName = keys[keyIndex] + '_renamed';
    console.log('objectChange: rename key ' + keyIndex + ' to ' + keyNewName);
    jsonNode[keyNewName] = jsonNode[keys[keyIndex]];
    delete jsonNode[keys[keyIndex]];
    keys.splice(keyIndex, 1);
    keys.push(keyNewName);
    break;

  case 2: // add key
    newKeyName = intRandom(0, 10000) + '_added';
    console.log('objectChange: adding key ' + newKeyName);
    jsonNode[newKeyName] = _generateNode(8);
    break;
  }
}

// Makes one random modification to a Javascript Array.
// Items can be removed, added, or shifted in the array.
function _modifyArrayNodeOnce(jsonNode)
{
  // available changes: remove element, insert element, shift element
  switch (intRandom(0,2)) {
  case 0: // remove element
    index = intRandom(0, jsonNode.length - 1);
    console.log('arrayChange: remove element ' + index);
    jsonNode.splice(index, 1);
    break;

  case 1: // insert element
    index = intRandom(0, jsonNode.length - 1);
    console.log('arrayChange: insert element ' + index);
    jsonNode.splice(index, 0, _generateNode(8));
    break;

  case 2: // shift element to new index
    startIndex = intRandom(0, jsonNode.length - 1);
    endIndex = intRandom(0, jsonNode.length - 1);
    console.log('arrayChange: move element ' + startIndex + ' to ' + endIndex);
    jsonNode.splice(endIndex, 0, jsonNode[startIndex]);
    if (endIndex < startIndex)
      startIndex ++;
    jsonNode.splice(startIndex, 1);
    break;
  }
}

// Cuts parentNode[key] from the parent and attaches it to a
// completely random part of the rootNode tree.
function _rerootKeyFromNode(parentNode, key)
{
  console.log('rerooting ' + key);

  var node = parentNode[key];
  if (parentNode instanceof Array)
    parentNode.splice(key, 1);
  else if (parentNode instanceof Object)
    delete parentNode[key];

  var attachmentPoints = _rerootCollectAttachmentPoints(rootNode);
  var attachmentPoint = attachmentPoints[intRandom(0, attachmentPoints.length - 1)];

  if (attachmentPoint instanceof Array)
    attachmentPoint.splice(intRandom(0, attachmentPoint.length - 1), 0, node);
  else if (attachmentPoint instanceof Object)
    attachmentPoint[key] = node;
}

// Collects all of the nodes which are potential attachment locations
// for a node being rerooted in _rerootKeyFromNode.
function _rerootCollectAttachmentPoints(node)
{
  var results = [];
  if ((node instanceof Object) || (node instanceof Array)) {
    results.push(node);
    for (key in node)
      results.concat(_rerootCollectAttachmentPoints(node[key]));
  }
  return results;
}

// Creates a completely random tree of Javascript Objects and Arrays
// with arbitrary contents. The tree size is limited by reducing maxKeys
// with each successive recursion.
function _generateNode(maxKeys)
{
  var keyCount = intRandom(Math.floor(maxKeys / 2), maxKeys);
  var childKeyCount = Math.floor(maxKeys / 3);
  if (keyCount == 0)
    return Math.random().toString(36).substring(10);

  if (intRandom(0, 1) == 0) {
    var jsonNode = {};

    for (var ii = 0; ii < keyCount; ii++) {
      var key = 'key_' + intRandom(1000,9999);
      var type = intRandom(0,4);
      if (type < 4) {
        var value = 'value ' + intRandom(1000,9999);
        jsonNode[key] = value;
      } else if (type == 4) {
        jsonNode[key] = _generateNode(childKeyCount);
      }
    }

  } else {
    var jsonNode = [];
    var arraySize = intRandom(0, childKeyCount);

    for (var ii = 0; ii < arraySize; ii++) {
      jsonNode.push(_generateNode(childKeyCount));
    }
  }

  return jsonNode;
}
