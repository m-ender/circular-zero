// Number of segments (triangles for the inside, quads for the outside)
// to construct the circle from.
var segments = 100;

var sin = Math.sin;
var cos = Math.cos;
var pi = Math.PI;

// Should return a number between 0 and 1 and is currently used for
// the R, G and B channels. Use Math.random for acid mode!
var colorFunction = function () { return 0; };

// Coordinates for a line around the circumference of a unit circle
var circumferenceCoords = [];

for (i = 0; i < segments; ++i)
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
function Circle(x, y, r, type)
{
    this.x = x;
    this.y = y;
    this.r = r;

    this.type = type || CircleType.Circumference;

    // Initialize attribute buffers
    var coords;
    var i;
    var angle;

    switch(this.type)
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

    this.vertices = {};
    this.vertices.data = new Float32Array(coords);

    this.vertices.bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.data, gl.STATIC_DRAW);

    var components = [];
    for (i = 0; i < coords.length / 2; ++i)
    {
        components.push(colorFunction());
        components.push(colorFunction());
        components.push(colorFunction());
        components.push(1.0);
    }

    this.colors = {};
    this.colors.data = new Float32Array(components);

    this.colors.bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors.bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors.data, gl.STATIC_DRAW);
}

Circle.prototype.render = function()
{
    gl.useProgram(circleProgram.program);

    gl.uniform2f(circleProgram.uCenter, this.x, this.y);
    gl.uniform1f(circleProgram.uR, this.r);

    gl.enableVertexAttribArray(circleProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.vertexAttribPointer(circleProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(circleProgram.aColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors.bufferId);
    gl.vertexAttribPointer(circleProgram.aColor, 4, gl.FLOAT, false, 0, 0);

    switch(this.type)
    {
    case CircleType.Inside:
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 2 + segments);
        break;
    case CircleType.Outside:
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 2 + 2*segments);
        break;
    case CircleType.Circumference:
    default:
        gl.drawArrays(gl.LINE_LOOP, 0, segments);
    }

    gl.disableVertexAttribArray(circleProgram.aPos);
    gl.disableVertexAttribArray(circleProgram.aColor);
};
