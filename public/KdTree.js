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

    // Determine type of geometry
    if (lChild instanceof OpenLeaf &&
        rChild instanceof ClosedLeaf)
    {
        if (geometry instanceof Circle)
            this.geometryType = CircleType.Outside;
        else if (geometry instanceof Line)
            this.geometryType = LineType.Right;
    }
    else if (lChild instanceof ClosedLeaf &&
             rChild instanceof OpenLeaf)
    {
        if (geometry instanceof Circle)
            this.geometryType = CircleType.Inside;
        else if (geometry instanceof Line)
            this.geometryType = LineType.Left;
    }
    else
    {
        // They can't both be closed, so they both have to be open
        if (geometry instanceof Circle)
            this.geometryType = CircleType.Circumference;
        else if (geometry instanceof Line)
            this.geometryType = LineType.Line;
    }

    this.geometry.addType(this.geometryType);

    // TODO: Compute these
    this.lChildArea = 0;
    this.rChildArea = 0;

    return this;
}

InnerNode.prototype.render = function() {
    // Implement the stencil-based rendering traversal here

    this.geometry.render(this.geometryType);

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

    // The new geometry is identical to the existing one... ignore it
    if (points === true)
        return; // Nothing to do here...

    // The new geometry intersects the existing one, add it to both
    // leaves.
    if (points.length)
    {
        this.insertLChild(geometry);
        this.insertRChild(geometry);
    }
    // The new geometry does not intersect the existing one, so we need
    // to figure out on which side it is.
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
    var child = this[propertyName];
    if (child instanceof ClosedLeaf)
        return;
    else if (child instanceof OpenLeaf)
    {
        var lEnemies = [];
        var rEnemies = [];

        // Sort enemies of child depending on which side of the new
        // geometry they are on.
        child.enemies.forEach(function(e) {
            if (geometry.liesLeftOf(e.x, e.y))
                lEnemies.push(e);
            else
                rEnemies.push(e);
        });

        // For a non-empty list, create an open leaf. Otherwise, create
        // a closed leaf.
        var lLeaf = lEnemies.length ? new OpenLeaf(lEnemies) : new ClosedLeaf();
        var rLeaf = rEnemies.length ? new OpenLeaf(rEnemies) : new ClosedLeaf();
        var newNode = new InnerNode(this, geometry, lLeaf, rLeaf);
        this[propertyName] = newNode;
    }
    else if (child instanceof InnerNode)
        child.insert(geometry);
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
    return indent + 'Open; ' + this.enemies.length + ' enemies\n';
};

OpenLeaf.prototype.render = function() {
    return; // Nothing to do here...
}
