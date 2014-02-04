
return;

var expect = require("expect.js");
var jsondiffpatch = require("../src/jsondiffpatch.js");
jsondiffpatch.config.diff_match_patch = require('../lib/diff_match_patch_uncompressed.js');

var deepEqual = function(obj1, obj2) {
    if (obj1 === obj2) {
        return true;
    }
    if (obj1 === null || obj2 == null) return false;
    if ((typeof obj1 === 'object') && (typeof obj2 === 'object')) {
        if (obj1 instanceof Date) {
            if (!(obj2 instanceof Date)) return false;
            return obj1.toString() === obj2.toString();
        }
        if (jsondiffpatch.isArray(obj1)) {
            if (!jsondiffpatch.isArray(obj2)) return false;
            if (obj1.length !== obj2.length) return false;
            var length = obj1.length;
            for (var i = 0; i < length; i++) {
                if (!deepEqual(obj1[i], obj2[i])) return false;
            }
            return true;
        }
        for (var name in obj2) {
            if (typeof obj1[name] == undefined) return false;
        }
        for (var name in obj1) {
            if (!deepEqual(obj1[name], obj2[name])) return false;
        }
        return true;
    }
    return false;
};

expect.Assertion.prototype.deepEqual = function(obj) {
    this.assert(
        deepEqual(this.obj, obj),
        function(){
            return 'expected ' + JSON.stringify(this.obj) + ' to be ' + JSON.stringify(obj);
        },
        function(){
            return 'expected ' + JSON.stringify(this.obj) + ' not to be ' + JSON.stringify(obj);
        });
    return this;
};

var valueDescription = function(value) {
    if (value === null) {
        return 'null';
    }
    if (typeof value == 'boolean') {
        return value.toString();
    }
    if (value instanceof Date) {
        return "Date";
    }
    if (jsondiffpatch.isArray(value)) {
        return "array";
    }
    if (typeof value == 'string') {
        if (value.length > jsondiffpatch.config.textDiffMinLength) {
            return "large text"
        }
    }
    return typeof value;
};

var clone = function(obj) {
    if (typeof obj == 'undefined') {
        return undefined;
    }
    return JSON.parse(JSON.stringify(obj), jsondiffpatch.dateReviver);
}

describe('Diff and Patch Examples', function(){
    var examples = require('./examples/diffpatch');
    Object.keys(examples).forEach(function(groupName){
        var group = examples[groupName];
        describe(groupName, function(){
            group.forEach(function(example){
                if (!example) return;
                var name = example.name || valueDescription(example.left) + ' -> ' + valueDescription(example.right);
                describe(name, function(){
                        before(function(){
                            this.instance = jsondiffpatch.create();
                        });
                        if (example.error) {
                        it('diff should fail with: ' + example.error, function(){
                            var instance = this.instance;
                            expect(function(){
                                var delta = instance.diff(example.left, example.right);
                            }).to.throwException(example.error);
                        });
                        return;
                    }
                    it('can diff', function(){
                        var delta = this.instance.diff(example.left, example.right);
                        expect(delta).to.be.deepEqual(example.delta);
                    });
                    it('can diff backwards', function(){
                        var reverse = this.instance.diff(example.right, example.left);
                        expect(reverse).to.be.deepEqual(example.reverse);
                    });
                    it('can patch', function(){
                        var right = this.instance.patch(clone(example.left), example.delta);
                        expect(right).to.be.deepEqual(example.right);
                    });
                    it('can reverse delta', function(){
                        var reverse = this.instance.reverse(example.delta);
                        if (example.exactReverse !== false) {
                            expect(reverse).to.be.deepEqual(example.reverse);
                        } else {
                            // reversed delta and the swapped-diff delta are not always equal,
                            // to verify they're equivalent, patch and compare the results
                            expect(this.instance.patch(clone(example.right), reverse)).to.be.deepEqual(example.left);
                            reverse = this.instance.diff(example.right, example.left);
                            expect(this.instance.patch(clone(example.right), reverse)).to.be.deepEqual(example.left);
                        }
                    });
                    it('can unpatch', function(){
                        var left = this.instance.unpatch(clone(example.right), example.delta);
                        expect(left).to.be.deepEqual(example.left);
                    });
                });
            });
        });
    });
});
