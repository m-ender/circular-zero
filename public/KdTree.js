// Represents an inner node of the tree.
// parent the preceding InnerNode in the tree or null for the
// root node.
// geometry is either a Circle or a Line, which represents
// the hyperplane that splits the 2d space.
// The two children can be passed in as lChild and rChild.
// For a Line, the definition of "left" and "right" is relative
// to the direction the line points in (defined by its angle).
// For a Circle, "left" refers to the inside of the circle and
// "right" to its outside. This is analogous to the line if you
// view the circle's circumference as a line that is traversed
// in a counter-clockwise sense.
function InnerNode(parent, geometry, lChild, rChild)
{
    this.parent = parent;
    this.geometry = geometry;

    lChild.parent = this;
    rChild.parent = this;

    this.lChild = lChild;
    this.rChild = rChild;

    // TODO: Compute these
    this.lChildArea = 0;
    this.rChildArea = 0;

    return this;
}

InnerNode.prototype.render = function() {
    // Implement the stencil-based rendering traversal here

    // The check is to avoid calling render() on leaf children
    this.geometry.render();

    this.lChild.render();
    this.rChild.render();
};

InnerNode.prototype.toString = function(depth) {
    depth = depth || 0;
    var indent = new Array(depth + 1).join('|');
    var type;

    if (this.geometry instanceof Circle)
        type = 'Circle node\n';
    else if (this.geometry instanceof Line)
        type = 'Line node\n';
    else
        type = 'some node...\n';

    return indent + type + this.lChild.toString(depth+1) + this.rChild.toString(depth+1);
};

InnerNode.prototype.insert = function(geometry) {
    var points = geometry.intersectionsWith(this.geometry);

    if (points === true)
        return; // Nothing to do here...

    if (points.length)
    {
        this.insertLChild(geometry);
        this.insertRChild(geometry);
    }
    else
    {
        // TODO: I think this needs to hide behind a double dispatch
        if (geometry instanceof Circle)
        {
            if (this.geometry instanceof Circle)
            {
                if (geometry.r < this.geometry.r && this.geometry.liesLeftOf(geometry.x, geometry.y))
                    this.insertLChild(geometry);
                else
                    this.insertRChild(geometry);
            }
            else if (this.geometry instanceof Line)
            {
                if (this.geometry.liesLeftOf(geometry.x, geometry.y))
                    this.insertLChild(geometry);
                else
                    this.insertRChild(geometry);
            }
        }
        else if (geometry instanceof Line)
            // If this.geometry is a line there is either an
            // intersection, or they are the same, so we never
            // reach this point.
            // If this.geometry is a circle, and there has been
            // no intersection, the line has to lie outside the
            // circle.
            this.insertRChild(geometry);
    }
};

InnerNode.prototype.insertLChild = function(geometry) {
    this.insertChild(geometry, 'lChild');
};

InnerNode.prototype.insertRChild = function(geometry) {
    this.insertChild(geometry, 'rChild');
};

InnerNode.prototype.insertChild = function(geometry, propertyName) {
    if (this[propertyName] instanceof ClosedLeaf)
        return;
    else if (this[propertyName] instanceof OpenLeaf)
    {
        // TODO: Figure out if new leaves have to be open or closed
        var newLeaf = new OpenLeaf([]);
        var newNode = new InnerNode(this, geometry, this[propertyName], newLeaf);
        this[propertyName] = newNode;
    }
    else if (this[propertyName] instanceof InnerNode)
        this[propertyName].insert(geometry);
};

// Represents a closed (filled) area. It will not be considered
// further for construction of the tree (so it terminates the
// current branch). It will however be considered for counting
// the total area.
function ClosedLeaf(parent)
{
    this.parent = parent || null;

    // TODO: Compute this
    this.area = 0;
}

ClosedLeaf.prototype.toString = function(depth) {
    var indent = new Array(depth + 1).join('|');
    return indent + 'Closed\n';
};

ClosedLeaf.prototype.render = function() {
    return; // Nothing to do here...
};

// Represents an open (unfilled) area, which still contains
// enemies. An open leaf may potentially be replaced by an
// inner node, which may either contain one open and one closed
// leaf or two open leafs (in which case the enemies will be
// separated over the two open leafs).
function OpenLeaf(enemies, parent)
{
    this.enemies = enemies;
    this.parent = parent || null;
}

OpenLeaf.prototype.toString = function(depth) {
    var indent = new Array(depth + 1).join('|');
    return indent + 'Open\n';
};

OpenLeaf.prototype.render = function() {
    return; // Nothing to do here...
}
