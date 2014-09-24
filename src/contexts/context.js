
var Pipe = require('../pipe').Pipe;

var Context = function Context(){
};

Context.prototype.setResult = function(result) {
	this.result = result;
	this.hasResult = true;
	return this;
};

Context.prototype.exit = function() {
	this.exiting = true;
	return this;
};

Context.prototype.switchTo = function(next, pipe) {
	if (typeof next === 'string' || next instanceof Pipe) {
		this.nextPipe = next;
	} else {
		this.next = next;
		if (pipe) {
			this.nextPipe = pipe;
		}
	}
	return this;
};

Context.prototype.push = function(child, name) {
	child.parent = this;
	if (typeof name !== 'undefined') {
		child.childName = name;
	}
	child.root = this.root || this;
	child.options = child.options || this.options;
	if (!this.children) {
		this.children = [child];
		this.nextAfterChildren = this.next || null;
		this.next = child;
	} else {
		this.children[this.children.length - 1].next = child;
		this.children.push(child);
	}
	child.next = this;
	return this;
};

exports.Context = Context;
