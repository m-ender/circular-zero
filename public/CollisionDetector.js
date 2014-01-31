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

CollisionDetector.prototype.intersectionsLineCircle = function(line, circle) {
    // Check if there is an intersection in the first place (tangential intersections
    // are not counted).
    if (!this.collideLineCircle(line, circle))
        return [];

    // Create a normalised vector along the line
    var x = cos(line.angle);
    var y = sin(line.angle);

    // Project the centre of the circle onto that vector (dot product).
    // Going this distance along the line will lead to the point halfway
    // between the intersections.
    var mu = x * circle.x + y * circle.y;

    // Project centre of the circle onto a vector perpendicular to the line.
    // This will be the perpendicular distance from the line.
    var d = abs(x * circle.y - y * circle.x);

    // Use Pythagoras to get the distance along the line to the two intersections.
    var dmu = sqrt(circle.r * circle.r - d * d);

    return [
        {
            x: x * (mu + dmu),
            y: y * (mu + dmu)
        },
        {
            x: x * (mu - dmu),
            y: y * (mu - dmu)
        }
    ];
};

// This will either return a list with a single point of intersection
// or true if the lines are the same.
CollisionDetector.prototype.intersectionsLines = function(line1, line2) {
    // If the lines seem parallel in screen space, we take them to
    // be the same.
    if (abs(line1.angle % pi - line2.angle % pi) < 1e-5)
        return true;
    else
        // By construction all lines go through the origin
        return [{
            x: 0,
            y: 0
        }];
};


// This will either return a (possibly empty) list with a single
// point of intersection or true if the lines are the same.
CollisionDetector.prototype.intersectionsCircles = function(circle1, circle2) {
    // Check if there is an intersection in the first place (tangential intersections
    // are not counted).
    if (!this.collideCircles(circle1, circle2))
        return [];

    // If the circles seem equal in screen space, we take them to
    // be the same.
    if (abs(circle1.x - circle2.x) < 1e-5 &&
        abs(circle1.y - circle2.y) < 1e-5 &&
        abs(circle1.r - circle2.r) < 1e-5)
        return true;

    // This computation follows from solving a system of two equations
    // obtained by pythagoras.

    // Distance between circles
    var dx = circle2.x - circle1.x;
    var dy = circle2.y - circle1.y;
    var d  = sqrt(dx*dx + dy*dy);

    // Distance from r1 to the point right between the intersections
    var mu = (d + (circle1.r*circle1.r - circle2.r*circle2.r)/d)/2;

    // Distance from that point to the intersections
    var h = sqrt(circle1.r*circle1.r - mu*mu);

    // Unit vector from c1 to c2
    var x = dx/d;
    var y = dy/d;

    // Construct points by following that unit vector and a vector
    // perpendicular to it.
    return [
        {
            x: circle1.x + x * mu + y * h,
            y: circle1.y + y * mu - x * h
        },
        {
            x: circle1.x + x * mu - y * h,
            y: circle1.y + y * mu + x * h
        }
    ];
};

// Just use this global object for all collision detection.
// Don't call it directly though... there are double-dispatch methods
// on the primitives which take care of that.
var collisionDetector = new CollisionDetector();
