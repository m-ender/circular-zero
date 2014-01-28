var atan2 = Math.atan2;
var pi = Math.PI;
var abs = Math.abs;
var sqrt = Math.sqrt;
var pow = Math.pow;

var canvas;
var messageBox;
var debugBox;

var gl;

// Objects holding data for individual shader programs
var circleProgram = {};
var lineProgram = {};

// Textures
// We will use three textures, whose roles will be shifted circularly every frame
// One texture is the one we are currently rendering to (and subsequently displaying)
// One texture is the one that is currently displayed and was rendered last frame
// One texture is the one that was displayed last frame and rendered two frames ago
// (We need to remember two previous frames in order to apply our finite difference scheme, as the wave equation is of second order in time)
var textures = [];
var rttFramebuffers = []; // Render to texture memory (this will store 3 framebuffers corresponding to the three textures)
var resolution = 512; // We're assuming a square aspect ratio
var viewPort = {};

var renderScale = 0.9; // means that the coordinate range [-1, 1] will fill 90% of the viewport
                       // the scaling is done in the shaders, but is has to be respected in obtaining coordinates from the mouse position

var previousTexture; // Points to the texture from two frames ago, so that we only ever need to add to this value (makes module maths simpler)

// Timing
// We need these to fix the framerate
var fps = 60;
var interval = 1000/fps;
var lastTime;

var rootCircle = null;

var cursor = null;

var activeLine = null;
var activeCircle = null;

var lines = [];
var circles = [];

var mouseDown = null;

// Gameplay configuration
var cursorSpeed = 2; // given in length units per second

window.onload = init;

function init()
{
    canvas = document.getElementById("gl-canvas");

    // This is the size we are rendering to
    viewPort.width = resolution;
    viewPort.height = resolution;
    // This is the actual extent of the canvas on the page
    canvas.style.width = viewPort.width;
    canvas.style.height = viewPort.height;
    // This is the resolution of the canvas (which will be scaled to the extent, using some rather primitive anti-aliasing techniques)
    canvas.width = viewPort.width;
    canvas.height = viewPort.height;

    canvas.addEventListener('mousedown', handleMouseDown, false);
    canvas.addEventListener('mouseup', handleMouseUp, false);
    canvas.addEventListener('mousemove', handleMouseMove, false);

    messageBox = $('#message');
    debugBox = $('#debug');

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        messageBox.html("WebGL is not available!");
    } else {
        messageBox.html("WebGL up and running!");
    }

    gl.clearColor(1, 1, 1, 1);

    // Load shaders and get uniform locations
    circleProgram.program = InitShaders(gl, "circle-vertex-shader", "minimal-fragment-shader");
    // add uniform locations
    circleProgram.uRenderScale = gl.getUniformLocation(circleProgram.program, "uRenderScale");
    circleProgram.uCenter = gl.getUniformLocation(circleProgram.program, "uCenter");
    circleProgram.uR = gl.getUniformLocation(circleProgram.program, "uR");
    circleProgram.uFromAngle = gl.getUniformLocation(circleProgram.program, "uFromAngle");
    circleProgram.uToAngle = gl.getUniformLocation(circleProgram.program, "uToAngle");
    // add attribute locations
    circleProgram.aPos = gl.getAttribLocation(circleProgram.program, "aPos");
    circleProgram.aColor = gl.getAttribLocation(circleProgram.program, "aColor");

    // fill uniforms that are already known
    gl.useProgram(circleProgram.program);
    gl.uniform1f(circleProgram.uRenderScale, renderScale);

    lineProgram.program = InitShaders(gl, "line-vertex-shader", "minimal-fragment-shader");
    // add uniform locations
    lineProgram.uRenderScale = gl.getUniformLocation(lineProgram.program, "uRenderScale");
    lineProgram.uAngle = gl.getUniformLocation(lineProgram.program, "uAngle");
    lineProgram.uToDistance = gl.getUniformLocation(lineProgram.program, "uToDistance");
    // add attribute locations
    lineProgram.aPos = gl.getAttribLocation(lineProgram.program, "aPos");
    lineProgram.aColor = gl.getAttribLocation(lineProgram.program, "aColor");

    gl.useProgram(lineProgram.program);
    gl.uniform1f(lineProgram.uRenderScale, renderScale);

    gl.useProgram(null);

    rootCircle = new Circle(0, 0, 1, CircleType.Outside);
    cursor = new Circle(1, 0, 0.05, CircleType.Inside, 0, 2*pi, 0.5);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    CheckError();

    lastTime = Date.now();
    update();
}

function InitShaders(gl, vertexShaderId, fragmentShaderId)
{
    var vertexShader;
    var fragmentShader;

    var vertexElement = document.getElementById(vertexShaderId);
    if(!vertexElement)
    {
        messageBox.html("Unable to load vertex shader '" + vertexShaderId + "'");
        return -1;
    }
    else
    {
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexElement.text);
        gl.compileShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        {
            messageBox.html("Vertex shader '" + vertexShaderId + "' failed to compile. The error log is:</br>" + gl.getShaderInfoLog(vertexShader));
            return -1;
        }
    }

    var fragmentElement = document.getElementById(fragmentShaderId);
    if(!fragmentElement)
    {
        messageBox.html("Unable to load fragment shader '" + fragmentShaderId + "'");
        return -1;
    }
    else
    {
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentElement.text);
        gl.compileShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        {
            messageBox.html("Fragment shader '" + fragmentShaderId + "' failed to compile. The error log is:</br>" + gl.getShaderInfoLog(fragmentShader));
            return -1;
        }
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        messageBox.html("Shader program failed to link. The error log is:</br>" + gl.getProgramInfoLog(program));
        return -1;
    }

    return program;
}

// This is a fixed-framerate game loop.
function update()
{
    window.requestAnimFrame(update, canvas);

    currentTime = Date.now();
    var dTime = currentTime - lastTime;

    if (dTime > interval)
    {
        // This drops a frame if dTime is greater than two intervals
        lastTime = currentTime - (dTime % interval);

        //if (lines.length && lines[lines.length-1].toDistance < 1)
        //    lines[lines.length-1].toDistance += cursorSpeed * dTime / 1000;

        drawScreen();
    }
}

function drawScreen()
{
    gl.enable(gl.BLEND);

    gl.viewport(0, 0, viewPort.width, viewPort.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    cursor.render();
    rootCircle.render();

    circles.forEach(function(c) { c.render(); });
    lines.forEach(function(l) { l.render(); });

    if (activeCircle)
        activeCircle.render();

    if (activeLine)
        activeLine.render();

    gl.disable(gl.BLEND);
}

function handleMouseMove(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    debugBox.find('#xcoord').html(coords.x);
    debugBox.find('#ycoord').html(coords.y);

    if (mouseDown)
    {
        if (snapToLine(coords.x, coords.y))
        {
            activeCircle.hide();
            activeLine.show();
        }
        else
        {
            activeCircle.show();
            activeLine.hide();

            // Calculate position of the circle, based on cursor
            // and mouse position.

            var mu = (pow(cursor.x - coords.x, 2) + pow(cursor.y - coords.y, 2)) / (cursor.x * coords.y - cursor.y * coords.x);

            var x = cursor.x - mu * cursor.y / 2;
            var y = cursor.y + mu * cursor.x / 2;

            activeCircle.move(x, y);

            activeCircle.resize(sqrt(pow(x - cursor.x, 2) + pow(y - cursor.y, 2)));
        }
    }
    else
    {
        var angle = atan2(coords.y, coords.x);

        cursor.move(cos(angle), sin(angle));
    }
}

function handleMouseDown(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    debugBox.find('#xdown').html(coords.x);
    debugBox.find('#ydown').html(coords.y);

    mouseDown = coords;
    activeLine = new Line(atan2(-cursor.y, -cursor.x));

    activeCircle = new Circle(cursor.x, cursor.y, 0.2);
    activeCircle.hide();
}

function handleMouseUp(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    debugBox.find('#xup').html(coords.x);
    debugBox.find('#yup').html(coords.y);

    mouseDown = null;

    if (!activeCircle.hidden)
        circles.push(activeCircle);
    else
    {
        lines.push(activeLine);
        //activeLine.toDistance = -1;
    }

    activeLine = null;
    activeCircle = null;
}

// Takes the mouse event and the rectangle to normalise for
// Outputs object with x, y coordinates in [-1,1] with positive
// y pointing upwards.
function normaliseCursorCoordinates(event, rect)
{
    return {
        x: (2*(event.clientX - rect.left) / resolution - 1) / renderScale,
        y: (1 - 2*(event.clientY - rect.top) / resolution) / renderScale, // invert, to make positive y point upwards
    };
}

// Determines if cursor and mouse are sufficiently closely aligned
// to snap to a straight line. Parameters are the coordinates of the
// mouse.
function snapToLine(x, y) {
    if (!activeLine)
        return false;

    // The angle of the line from the cursor to the mouse.
    var pointedAngle = atan2(y - cursor.y, x - cursor.x);

    // There is a branch cut at an angle of +/- pi, which means
    // that if the two angles are really close, but one in the 2nd
    // and one in the third quadrant, their difference will erroneously
    // be about 2pi. To fix this, we modify the pointed angle accordingly.

    if (pointedAngle > pi/2 && activeLine.angle < -pi/2)
        pointedAngle -= 2*pi;
    else if (pointedAngle < -pi/2 && activeLine.angle > pi/2)
        pointedAngle += 2*pi;

    // Snap if we're less than 5 degrees away the line
    return abs(pointedAngle - activeLine.angle) < 2 * pi / 180;
}

function CheckError(msg)
{
    var error = gl.getError();
    if (error !== 0)
    {
        var errMsg = "OpenGL error: " + error.toString(16);
        if (msg) { errMsg = msg + "</br>" + errMsg; }
        messageBox.html(errMsg);
    }
}
