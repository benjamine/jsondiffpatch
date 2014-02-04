
var Pipe = function Pipe(name){
	this.name = name;
	this.filters = [];
};

Pipe.prototype.process = function(input) {
	if (!this.processor) {
		throw new Error('add this pipe to a processor before using it');
	}
	var length = this.filters.length;
	var context = input;
	for (var index = 0; index < length; index++) {
		var filter = this.filters[index];
		filter(context);
		if (typeof context === 'object' && context.exiting) {
			context.exiting = false;
			break;
		}
	}
    if (!context.next && this.resultCheck) {
    	this.resultCheck(context);
    }
};

Pipe.prototype.append = function() {
	this.filters.push.apply(this.filters, arguments);
	return this;
};

Pipe.prototype.prepend = function() {
	this.filters.unshift.apply(this.filters, arguments);
	return this;
};

Pipe.prototype.clear = function() {
	this.filters.length = 0;
	return this;
};

Pipe.prototype.shouldHaveResult = function() {
	if (this.resultCheck) return;
	var pipe = this;
	this.resultCheck = function(context) {
	    if (!context.hasResult) {
	    	console.log(context);
	    	var error = new Error(pipe.name + ' failed');
	    	error.noResult = true;
	    	throw error;
	    }
	};
	return this;
};

exports.Pipe = Pipe;