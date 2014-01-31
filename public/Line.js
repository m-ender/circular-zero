var lineCoords = [-1, 0,
                   1, 0];

var leftCoords = [-10,  0,
                   10,  0,
                    0, 10];

var rightCoords = [-10,   0,
                     0, -10,
                    10,   0];

var LineType = {
    Line: "line",   // Both sides are left open, only the line
                    // itself is drawn
    Left: "left",   // The lefthand side will be filled, the right side left open
    Right: "right", // The righthand side will be filled, the left side left open
};

// An infinite line through the origin. One side of the line can be filled, where
// "lefthand" and "righthand" side refer to the direction vector.
// angle is the direction the line should point towards from the origin.
// Adding pi to the angle will switch the roles of left and right!
// The third parameter should be a member of LineType (see above).
// The default type is LineType.Line.
// toDistance is an optional parameter to draw only part of a LineType.Line. It
// needs to be in range [-1, 1], with -1 corresponding to the start of the line
// and 1 corresponding to the end of a full line.
function Line(angle, type, toDistance)
{
    this.hidden = false;

    this.angle = angle;

    this.type = type || LineType.Line;

    this.toDistance = (toDistance === undefined) ? 1 : toDistance;

    // Initialize attribute buffers
    var coords;
    var i;

    switch(this.type)
    {
    case LineType.Left:
        coords = leftCoords;
        break;
    case LineType.Right:
        coords = rightCoords;
        break;
    case LineType.Line:
    default:
        coords = lineCoords;
    }

    this.vertices = {};
    this.vertices.data = new Float32Array(coords);

    this.vertices.bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.data, gl.STATIC_DRAW);

    var components = [];
    for (i = 0; i < coords.length / 2; ++i)
    {
        components.push(0);
        components.push(0);
        components.push(0);
        components.push(1);
    }

    this.colors = {};
    this.colors.data = new Float32Array(components);

    this.colors.bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors.bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors.data, gl.STATIC_DRAW);
}

Line.prototype.hide = function() { this.hidden = true; };
Line.prototype.show = function() { this.hidden = false; };

Line.prototype.render = function()
{
    if (this.hidden) return;

    gl.useProgram(lineProgram.program);

    gl.uniform1f(lineProgram.uAngle, this.angle);

    if (this.type === LineType.Line)
        gl.uniform1f(lineProgram.uToDistance, this.toDistance);
    else
        gl.uniform1f(lineProgram.uToDistance, 10);

    gl.enableVertexAttribArray(lineProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.vertexAttribPointer(lineProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(lineProgram.aColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors.bufferId);
    gl.vertexAttribPointer(lineProgram.aColor, 4, gl.FLOAT, false, 0, 0);

    switch(this.type)
    {
    case LineType.Left:
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        break;
    case LineType.Right:
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        break;
    case LineType.Line:
    default:
        gl.drawArrays(gl.LINES, 0, 2);
    }

    gl.disableVertexAttribArray(lineProgram.aPos);
    gl.disableVertexAttribArray(lineProgram.aColor);
};

// Returns the point corresponding to toDistance
Line.prototype.getEndPoint = function(other) {
    // Get normal vector along this.angle
    var x = cos(this.angle);
    var y = sin(this.angle);

    return {
        x: x * this.toDistance,
        y: y * this.toDistance
    };
};

// Double-dispatch collision detection
Line.prototype.collidesWith = function(other) {
    return other.collidesWithLine(this);
};

Line.prototype.collidesWithLine = function(other) {
    return collisionDetector.collideLines(this, other);
};

Line.prototype.collidesWithCircle = function(other) {
    return collisionDetector.collideLineCircle(this, other);
};

Line.prototype.intersectionsWith = function(other) {
    return other.intersectionsWithLine(this);
};

Line.prototype.intersectionsWithLine = function(other) {
    return collisionDetector.intersectionsLines(this, other);
};

Line.prototype.intersectionsWithCircle = function(other) {
    return collisionDetector.intersectionsLineCircle(this, other);
};
