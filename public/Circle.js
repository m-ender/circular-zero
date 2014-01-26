// Number of segments (triangles for the inside, quads for the outside)
// to construct the circle from.
var segments = 100;

var sin = Math.sin;
var cos = Math.cos;
var pi = Math.PI;

// Should return a number between 0 and 1 and is currently used for
// the R, G and B channels. Use Math.random for acid mode!
var colorFunction = function () { return 0; };

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

// x and y are the coordinates of the circle's center, r is the radius.
// if the fourth parameter is true, the outside will be rendered instead
// of the inside.
function Circle(x, y, r, outside)
{
    this.x = x;
    this.y = y;
    this.r = r;

    this.outside = !!outside; // convert to boolean

    // Initialize attribute buffers
    var coords;
    var i;
    var angle;

    if (!outside)
        coords = insideCoords;
    else
        coords = outsideCoords;

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
    gl.useProgram(defaultProgram.program);

    gl.uniform2f(defaultProgram.uCenter, this.x, this.y);
    gl.uniform1f(defaultProgram.uR, this.r);

    gl.enableVertexAttribArray(defaultProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.vertexAttribPointer(defaultProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(defaultProgram.aColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors.bufferId);
    gl.vertexAttribPointer(defaultProgram.aColor, 4, gl.FLOAT, false, 0, 0);

    if (!this.outside)
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 2 + segments);
    else
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 2 + 2*segments);

    gl.disableVertexAttribArray(defaultProgram.aPos);
    gl.disableVertexAttribArray(defaultProgram.aColor);
};
