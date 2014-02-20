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
// fromT and toT are optional parameters to draw only part of a
// LineType.Line. They need to be in range [-1, 1], with -1 corresponding to
// the start of the full line and 1 corresponding to the end of a full line.
// The color is optional and can be used to overwrite the global colorFunction.
function Line(angle, type, fromT, toT, color)
{
    this.hidden = false;

    this.angle = angle;

    this.fromT = (fromT === undefined) ? 1 : fromT;
    this.toT = (toT === undefined) ? 1 : toT;

    this.color = color || [colorFunction(), colorFunction(), colorFunction()];

    // OpenGL data goes here
    this.vertices = {};
    this.colors = {};


    // Initialize attribute buffers
    var coords;
    var i;

    type = type || LineType.Line;

    this.addType(type);
}

Line.prototype.addType = function(type) {
    // Don't add a type twice
    if (this.vertices.hasOwnProperty(type))
        return;

    // Initialize attribute buffers
    var coords;

    switch(type)
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

// "Destructor" - this has to be called manually
Line.prototype.destroy = function() {
    var type;
    for (type in this.vertices)
    {
        if (!this.vertices.hasOwnProperty(type))
            continue;

        gl.deleteBuffer(this.vertices[type].bufferId);
        delete this.vertices[type];
    }

    for (type in this.colors)
    {
        if (!this.colors.hasOwnProperty(type))
            continue;

        gl.deleteBuffer(this.colors[type].bufferId);
        delete this.colors[type];
    }
};

Line.prototype.hide = function() { this.hidden = true; };
Line.prototype.show = function() { this.hidden = false; };


// Before rendering with a type different from the one the object
// was created with, you need to call addType().
Line.prototype.render = function(type) {
    if (this.hidden) return;

    gl.useProgram(lineProgram.program);

    gl.uniform1f(lineProgram.uAngle, this.angle);

    if (type === LineType.Line)
    {
        gl.uniform1f(lineProgram.uFromDistance, this.fromT);
        gl.uniform1f(lineProgram.uToDistance, this.toT);
    }
    else
    {
        gl.uniform1f(lineProgram.uFromDistance, -10);
        gl.uniform1f(lineProgram.uToDistance, 10);
    }

    gl.enableVertexAttribArray(lineProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices[type].bufferId);
    gl.vertexAttribPointer(lineProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(lineProgram.aColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colors[type].bufferId);
    gl.vertexAttribPointer(lineProgram.aColor, 4, gl.FLOAT, false, 0, 0);

    switch(type)
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

// Returns the point corresponding to toT
Line.prototype.getEndPoint = function(other) {
    // Get normal vector along this.angle
    var x = cos(this.angle);
    var y = sin(this.angle);

    return {
        x: x * this.toT,
        y: y * this.toT
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

// Does the given point lie left or right of the line?
// True for the former, false for the latter.
Line.prototype.liesLeftOf = function(x, y) {
    return collisionDetector.liesLeftOfLine(x, y, this);
};
