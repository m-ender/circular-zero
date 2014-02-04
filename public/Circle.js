// Number of segments (triangles for the inside, quads for the outside)
// to construct the circle from.
var segments = 100;

// Should return a number between 0 and 1 and is currently used for
// the R, G and B channels. Use Math.random for acid mode!
var colorFunction = function () { return 0; };

// Coordinates for a line around the circumference of a unit circle
var circumferenceCoords = [];

for (i = 0; i <= segments; ++i)
{
    angle = i * 2*pi / segments;

    circumferenceCoords.push(cos(angle));
    circumferenceCoords.push(sin(angle));
}

// Coordinates for the inside of a unit circle
var insideCoords =
    [0, 0,  // center vertex
     1, 0]; // radial vertex right of the center

for (i = 1; i <= segments; ++i)
{
    angle = i * 2*pi / segments;

    insideCoords.push(cos(angle));
    insideCoords.push(sin(angle));
}

// Coordinates for the outside of a unit circle
// We actually render a ring, with the outer radius sufficiently large
// to lie outside the viewport.
var outsideCoords =
    [1, 0,    // radial vertex right of center
     1e5, 0]; // faraway vertex right of center; make sure not to use
              // radii below 1e-4... otherwise the outer radius will
              // be visible inside the viewport

for (i = 1; i <= segments; ++i)
{
    angle = i * 2*pi / segments;

    outsideCoords.push(cos(angle));
    outsideCoords.push(sin(angle));
    outsideCoords.push(1e5*cos(angle));
    outsideCoords.push(1e5*sin(angle));
}

var CircleType = {
    Circumference: "circumference",        // Both inside and outside are left open,
                        // only the circumference is drawn
    Inside: "inside",   // Inside will be filled, outside left open
    Outside: "outside", // Outside will be filled, inside left open
};

// x and y are the coordinates of the circle's center, r is the radius.
// The fourth parameter should be a member of CircleType (see above).
// The default type is CircleType.Circumference.
// fromAngle and toAngle are optional and can be used to draw an arc only. Use
// angles in the range [0, 2pi].
// The color is optional and can be used to overwrite the global colorFunction.
function Circle(x, y, r, type, fromAngle, toAngle, color)
{
    this.hidden = false;

    this.x = x;
    this.y = y;
    this.r = r;

    this.fromAngle = fromAngle || 0;
    this.toAngle = (toAngle === undefined) ? 2*pi : toAngle;

    this.color = color || [colorFunction(), colorFunction(), colorFunction()];

    // OpenGL data goes here
    this.vertices = {};
    this.colors = {};

    type = type || CircleType.Circumference;

    this.addType(type);
}

Circle.prototype.addType = function(type) {
    // Don't add a type twice
    if (this.vertices.hasOwnProperty(type))
        return;

    // Initialize attribute buffers
    var coords;

    switch(type)
    {
    case CircleType.Inside:
        coords = insideCoords;
        break;
    case CircleType.Outside:
        coords = outsideCoords;
        break;
    case CircleType.Circumference:
    default:
        coords = circumferenceCoords;
    }

    this.vertices[type] = {};
    this.vertices[type].data = new Float32Array(coords);

    this.vertices[type].bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices[type].bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices[type].data, gl.STATIC_DRAW);

    var components = [];
    for (var i = 0; i < coords.length / 2; ++i)
    {
        components.push(this.color[0]);
        components.push(this.color[1]);
        components.push(this.color[2]);
        components.push(1.0);
    }

    this.colors[type] = {};
    this.colors[type].data = new Float32Array(components);

    this.colors[type].bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors[type].bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors[type].data, gl.STATIC_DRAW);
};

// Convenient setters
Circle.prototype.move = function(x, y) {
    this.x = x;
    this.y = y;
};

Circle.prototype.resize = function(r) {
    this.r = r;
};

Circle.prototype.hide = function() { this.hidden = true; };
Circle.prototype.show = function() { this.hidden = false; };

// Before rendering with a type different from the one the object
// was created with, you need to call addType().
Circle.prototype.render = function(type) {
    if (this.hidden) return;

    gl.useProgram(circleProgram.program);

    gl.uniform2f(circleProgram.uCenter, this.x, this.y);
    gl.uniform1f(circleProgram.uR, this.r);
    gl.uniform1f(circleProgram.uFromAngle, this.fromAngle);
    gl.uniform1f(circleProgram.uToAngle, this.toAngle);

    gl.enableVertexAttribArray(circleProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices[type].bufferId);
    gl.vertexAttribPointer(circleProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(circleProgram.aColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors[type].bufferId);
    gl.vertexAttribPointer(circleProgram.aColor, 4, gl.FLOAT, false, 0, 0);

    switch(type)
    {
    case CircleType.Inside:
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 2 + segments);
        break;
    case CircleType.Outside:
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 2 + 2*segments);
        break;
    case CircleType.Circumference:
    default:
        // We use line strip so that the shader can bend the
        // vertices to give an arc.
        gl.drawArrays(gl.LINE_STRIP, 0, segments + 1);
    }

    gl.disableVertexAttribArray(circleProgram.aPos);
    gl.disableVertexAttribArray(circleProgram.aColor);
};

// Returns the point corresponding to toDistance
Circle.prototype.getEndPoint = function(other) {
    // Construct point from radius, centre and this.toAngle
    return {
        x: this.x + this.r * cos(this.toAngle),
        y: this.y + this.r * sin(this.toAngle)
    };
};


// Double-dispatch collision detection
Circle.prototype.collidesWith = function(other) {
    return other.collidesWithCircle(this);
};

Circle.prototype.collidesWithLine = function(other) {
    return collisionDetector.collideLineCircle(other, this);
};

Circle.prototype.collidesWithCircle = function(other) {
    return collisionDetector.collideCircles(this, other);
};

Circle.prototype.intersectionsWith = function(other) {
    return other.intersectionsWithCircle(this);
};

Circle.prototype.intersectionsWithLine = function(other) {
    return collisionDetector.intersectionsLineCircle(other, this);
};

Circle.prototype.intersectionsWithCircle = function(other) {
    return collisionDetector.intersectionsCircles(this, other);
};

// Does the given point lie left (inside) or right (outside)
// of the circumference? True for the former, false for the
// latter.
Circle.prototype.liesLeftOf = function(x, y) {
    return collisionDetector.liesLeftOfCircle(x, y, this);
};
