```diff()```, ```patch()``` and ```reverse()``` functions are implemented using a pipes &filters pattern, making them extremely customizable by adding or replacing filters.

Some examples of what you can acheive writing your own filter:
- diff special custom objects (eg. DOM nodes, native objects, functions, RegExp, node.js streams?)
- ignore parts of the graph using any custom rule (type, path, flags)
- change diff strategy in specific parts of the graph, eg. rely on change tracking info for Knockout.js tracked objects
- implement custom diff mechanisms, like relative numeric deltas
- suprise me! :)

Check the ```/src/filters``` folder for more example code.
