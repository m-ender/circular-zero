var canvas;
var messageBox;
var debugBox;

var gl;

// Objects holding data for individual shader programs
var defaultProgram = {};

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

var previousTexture; // Points to the texture from two frames ago, so that we only ever need to add to this value (makes module maths simpler)

// Timing
// We need these to fix the framerate
var fps = 60;
var interval = 1000/fps;
var lastTime;

var circles = [];

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
    defaultProgram.program = InitShaders(gl, "default-vertex-shader", "default-fragment-shader");
    // add uniform locations
    defaultProgram.uCenter = gl.getUniformLocation(defaultProgram.program, "uCenter");
    defaultProgram.uR = gl.getUniformLocation(defaultProgram.program, "uR");
    // add attribute locations
    defaultProgram.aPos = gl.getAttribLocation(defaultProgram.program, "aPos");
    defaultProgram.aColor = gl.getAttribLocation(defaultProgram.program, "aColor");

    // fill uniforms that are already known
    // gl.useProgram(defaultProgram.program);
    // gl.uniform1i(defaultProgram.uBCTexture, 0);

    gl.useProgram(null);

    circles.push(new Circle(0, 0, 1, true));
    circles.push(new Circle(0, 0, 0.9));

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    CheckError();

    lastTime = Date.now();
    render();
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

// This is a fixed-framerate rendering loop.
function render()
{
    window.requestAnimFrame(render, canvas);

    currentTime = Date.now();
    var dTime = currentTime - lastTime;

    if (dTime > interval)
    {
        // This drops a frame if dTime is greater than two intervals
        lastTime = currentTime - (dTime % interval);

        drawScreen();
    }
}

function drawScreen()
{
    gl.enable(gl.BLEND);

    gl.viewport(0, 0, viewPort.width, viewPort.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    circles.forEach(function(c) { c.render(); });

    gl.disable(gl.BLEND);
}

function handleMouseMove(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    debugBox.find('#xcoord').html(coords.x);
    debugBox.find('#ycoord').html(coords.y);
}

function handleMouseDown(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    debugBox.find('#xdown').html(coords.x);
    debugBox.find('#ydown').html(coords.y);
}

function handleMouseUp(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    debugBox.find('#xup').html(coords.x);
    debugBox.find('#yup').html(coords.y);
}

// Takes the mouse event and the rectangle to normalise for
// Outputs object with x, y coordinates in [-1,1] with positive
// y pointing upwards.
function normaliseCursorCoordinates(event, rect)
{
    return {
        x: 2*(event.clientX - rect.left) / resolution - 1,
        y: 1 - 2*(event.clientY - rect.top) / resolution, // invert, to make positive y point upwards
    };
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
