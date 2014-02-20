// We keep a global list of open leaves to traverse these
// quickly for enemy collisions.
var openLeaves = [];

// Represents an inner node of the tree.
// parent the preceding InnerNode in the tree or null for the
// root node.
// geometry is either a Circle or a Line, which represents
// the hyperplane that splits the 2d space.
// area is the total area occupied by this nodes children.
// The two children can be passed in as lChild and rChild.
// For a Line, the definition of "left" and "right" is relative
// to the direction the line points in (defined by its angle).
// For a Circle, "left" refers to the inside of the circle and
// "right" to its outside. This is analogous to the line if you
// view the circle's circumference as a line that is traversed
// in a counter-clockwise sense.
function InnerNode(parent, geometry, area, lChild, rChild)
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
        // Add the other types as well - we'll need them for the stencil
        // buffer.
        if (geometry instanceof Circle)
        {
            this.geometryType = CircleType.Circumference;
            geometry.addType(CircleType.Inside);
            geometry.addType(CircleType.Outside);
        }
        else if (geometry instanceof Line)
        {
            this.geometryType = LineType.Line;
            geometry.addType(LineType.Left);
            geometry.addType(LineType.Right);
        }
    }

    this.geometry.addType(this.geometryType);

    // For Monte-Carlo-based area computation
    this.area = area;
    this.lChildSamples = 0;
    this.rChildSamples = 0;

    return this;
}

InnerNode.prototype.destroy = function() {
    this.parent = null;
    this.geometry.destroy();
    this.lChild.destroy();
    this.rChild.destroy();
    this.lChild = null;
    this.rChild = null;
};

InnerNode.prototype.render = function() {
    if (this.geometryType === CircleType.Circumference)
    {
        // Draw the geometry itself
        stencilBuffer.renderToColorBuffer();
        this.geometry.render(this.geometryType);

        // Mask out the outside, then draw the inside
        stencilBuffer.incrementOnRender();
        this.geometry.render(CircleType.Outside);

        this.lChild.render();

        // Undo changes to the stencil buffer
        stencilBuffer.decrementOnRender();
        this.geometry.render(CircleType.Outside);

        // Mask out the inside, then draw the outside
        stencilBuffer.incrementOnRender();
        this.geometry.render(CircleType.Inside);

        this.rChild.render();

        // Undo changes to the stencil buffer
        stencilBuffer.decrementOnRender();
        this.geometry.render(CircleType.Inside);
    }
    else if (this.geometryType === LineType.Line)
    {
        // Draw the geometry itself
        stencilBuffer.renderToColorBuffer();
        this.geometry.render(this.geometryType);

        // Mask out the right-hand side, then draw the left-hand side
        stencilBuffer.incrementOnRender();
        this.geometry.render(LineType.Right);

        this.lChild.render();

        // Undo changes to the stencil buffer
        stencilBuffer.decrementOnRender();
        this.geometry.render(LineType.Right);

        // Mask out the left-hand side, then draw the right-hand side
        stencilBuffer.incrementOnRender();
        this.geometry.render(LineType.Left);

        this.rChild.render();

        // Undo changes to the stencil buffer
        stencilBuffer.decrementOnRender();
        this.geometry.render(LineType.Left);
    }
    else
    {
        // Draw the geometry itself
        stencilBuffer.renderToColorBuffer();
        this.geometry.render(this.geometryType);

        // Mask out the closed child, then draw the open child
        stencilBuffer.incrementOnRender();
        this.geometry.render(this.geometryType);

        // One of these will be a closed leaf, so only the other
        // one will actually draw more geometry.
        this.lChild.render();
        this.rChild.render();

        // Undo changes to the stencil buffer
        stencilBuffer.decrementOnRender();
        this.geometry.render(this.geometryType);
    }
};

InnerNode.prototype.toString = function(depth) {
    depth = depth || 0;
    var indent = new Array(depth + 1).join('|');
    var type;

    if (this.geometry instanceof Circle)
        type = 'Circle node';
    else if (this.geometry instanceof Line)
        type = 'Line node';
    else
        type = 'some node...';

    return indent + type + '; A: ' + this.area.toFixed(2) + '\n' + this.lChild.toString(depth+1) + this.rChild.toString(depth+1);
};

InnerNode.prototype.insert = function(geometry, affectedLeaves, intersections) {
    var points = geometry.intersectionsWith(this.geometry);

    // The new geometry is identical to the existing one... ignore it
    if (points === true)
        return; // Nothing to do here...

    // The new geometry intersects the existing one, add it to both
    // leaves.
    if (points.length)
    {
        // By construction only one intersection lies inside the unit
        // circle. Except with the root circle, so we somehow need to
        // take care of that case. I admit the current solution is
        // more hack than anything else.
        if (this.parent !== null)
        {
            var p;
            if (points[0].x*points[0].x + points[0].y*points[0].y < 1)
                p = points[0];
            else
                p = points[1];

            var t;

            if (geometry instanceof Circle)
            {
                // Get vector from center of circle to intersection
                var dx = p.x - geometry.x;
                var dy = p.y - geometry.y;

                var angle = atan2(dy,dx);

                // Correct angle to lie within pi of the circle's starting angle
                if (angle - geometry.fromT > pi)
                    angle -= 2*pi;
                else if (angle - geometry.fromT < -pi)
                    angle += 2*pi;

                t = angle;
            }
            else if (geometry instanceof Line)
            {
                var lx = cos(geometry.angle);
                var ly = sin(geometry.angle);

                // Project intersection onto line
                t = lx*p.x + ly*p.y;
            }

            // Add the intersection if it is not present yet
            if (intersections.indexOf(t) === -1)
                intersections.push(t);
        }

        this.insertLChild(geometry, affectedLeaves, intersections);
        this.insertRChild(geometry, affectedLeaves, intersections);
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
                    this.insertLChild(geometry, affectedLeaves, intersections);
                else
                    this.insertRChild(geometry, affectedLeaves, intersections);
            }
            else if (this.geometry instanceof Line)
            {
                if (this.geometry.liesLeftOf(geometry.x, geometry.y))
                    this.insertLChild(geometry, affectedLeaves, intersections);
                else
                    this.insertRChild(geometry, affectedLeaves, intersections);
            }
        }
        else if (geometry instanceof Line)
            // If this.geometry is a line there is either an
            // intersection, or they are the same, so we never
            // reach this point.
            // If this.geometry is a circle, and there has been
            // no intersection, the line has to lie outside the
            // circle.
            this.insertRChild(geometry, affectedLeaves, intersections);
    }
};

InnerNode.prototype.insertLChild = function(geometry, affectedLeaves, intersections) {
    return this.insertChild(geometry, affectedLeaves, intersections, 'lChild');
};

InnerNode.prototype.insertRChild = function(geometry, affectedLeaves, intersections) {
    return this.insertChild(geometry, affectedLeaves, intersections, 'rChild');
};

InnerNode.prototype.insertChild = function(geometry, affectedLeaves, intersections, propertyName) {
    var child = this[propertyName];
    if (child instanceof ClosedLeaf)
        return;
    else if (child instanceof OpenLeaf)
    {
        child.geometry = geometry;
        affectedLeaves.push(child);
    }
    else if (child instanceof InnerNode)
        child.insert(geometry, affectedLeaves, intersections);
};

InnerNode.prototype.registerSample = function(x, y) {
    if (this.geometry.liesLeftOf(x,y))
    {
        ++this.lChildSamples;
        this.lChild.registerSample(x,y);
    }
    else
    {
        ++this.rChildSamples;
        this.rChild.registerSample(x,y);
    }
};

InnerNode.prototype.probeTree = function(x,y) {
    if (this.geometry.liesLeftOf(x,y))
        return this.lChild.probeTree(x,y);
    else
        return this.rChild.probeTree(x,y);
};

InnerNode.prototype.recalculateAreas = function() {
    var lFraction = this.lChildSamples / (this.lChildSamples + this.rChildSamples);

    this.lChild.area = this.area * lFraction;
    this.rChild.area = this.area * (1 - lFraction);

    return this.lChild.recalculateAreas() +
           this.rChild.recalculateAreas();
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

ClosedLeaf.prototype.destroy = function() {
    this.parent = null;
};

ClosedLeaf.prototype.toString = function(depth) {
    var indent = new Array(depth + 1).join('|');
    return indent + 'Closed; A: ' + this.area.toFixed(2) + '\n';
};

ClosedLeaf.prototype.render = function() {
    return; // Nothing to do here...
};

ClosedLeaf.prototype.registerSample = function(x, y) {
    return; // Nothing to do here...
};

ClosedLeaf.prototype.probeTree = function(x,y) {
    return this;
};

ClosedLeaf.prototype.recalculateAreas = function(x, y) {
    return this.area;
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

    this.area = 0;

    this.lChildSamples = 0;
    this.rChildSamples = 0;

    openLeaves.push(this);
}

OpenLeaf.prototype.destroy = function() {
    if (this.enemies)
    {
        for (var i = 0; i < this.enemies.length; ++i)
            this.enemies[i].destroy();
        this.enemies = null;
    }

    var index = openLeaves.indexOf(this);
    openLeaves.splice(index, 1);

    if (this.geometry)
    {
        this.geometry.destroy();
        this.geometry = null;
    }
};

OpenLeaf.prototype.toString = function(depth) {
    var indent = new Array(depth + 1).join('|');
    return indent + 'Open;   A: '+ this.area.toFixed(2) + '; N(e): ' + this.enemies.length + '\n';
};

OpenLeaf.prototype.render = function() {
    return; // Nothing to do here...
};

OpenLeaf.prototype.registerSample = function(x, y) {
    if (!this.geometry)
        return; // Nothing to do here...

    if (this.geometry.liesLeftOf(x,y))
        ++this.lChildSamples;
    else
        ++this.rChildSamples;
};

OpenLeaf.prototype.probeTree = function(x,y) {
    return this;
};

OpenLeaf.prototype.recalculateAreas = function(x, y) {
    return 0; // Does not contribute to closed off areas
};

OpenLeaf.prototype.subdivide = function() {
    if (!this.geometry)
        return;

    var lEnemies = [];
    var rEnemies = [];

    // Sort enemies depending on which side of the new
    // geometry they are on.
    var that = this;
    this.enemies.forEach(function(e) {
        if (that.geometry.liesLeftOf(e.x, e.y))
            lEnemies.push(e);
        else
            rEnemies.push(e);
    });

    // For a non-empty list, create an open leaf. Otherwise, create
    // a closed leaf.
    var lLeaf = lEnemies.length ? new OpenLeaf(lEnemies) : new ClosedLeaf();
    var rLeaf = rEnemies.length ? new OpenLeaf(rEnemies) : new ClosedLeaf();
    var newNode = new InnerNode(this.parent, this.geometry, this.area, lLeaf, rLeaf);

    newNode.lChildSamples = this.lChildSamples;
    newNode.rChildSamples = this.rChildSamples;

    if (this.parent.lChild === this)
        this.parent.lChild = newNode;
    else
        this.parent.rChild = newNode;

    // Avoid destruction of geometry or enemies, as they are shared with other nodes
    this.geometry = null;
    this.enemies = null;

    this.destroy();
};
