var pi = Math.PI;
var sqrt = Math.sqrt;
var abs = Math.abs;
var sin = Math.sin;
var cos = Math.cos;

function CollisionDetector() {
    return this;
}

CollisionDetector.prototype.collideLineCircle = function(line, circle) {
    // Create a normalised vector perpendicular to this line.
    var x = cos(line.angle + pi/2);
    var y = sin(line.angle + pi/2);

    // Project the centre of the circle onto that vector (dot product).
    // This will be the perpendicular distance from the line
    var d = abs(x * circle.x + y * circle.y);

    // The line will intersect the circle if it's closer to the circle's
    // centre than the radius.
    return d < circle.r;
};

CollisionDetector.prototype.collideLines = function(line1, line2) {
    // By construction all lines go through the origin
    return true;
};

CollisionDetector.prototype.collideCircles = function(circle1, circle2) {
    // The circles intersect, if the distance between their centres
    // lies between |r1 - r2| and r1 + r2.

    var dx = circle1.x - circle2.x;
    var dy = circle1.y - circle2.y;
    var d = sqrt(dx*dx + dy*dy);

    return (abs(circle1.r - circle2.r) < d) && (d < circle1.r + circle2.r);
};

// Just use this global object for all collision detection.
// Don't call it directly though... there are double-dispatch methods
// on the primitives which take care of that.
var collisionDetector = new CollisionDetector();
